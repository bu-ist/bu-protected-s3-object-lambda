/* eslint-disable linebreak-style */
// first example here: https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html
const { S3 } = require('@aws-sdk/client-s3');

const { authorizeRequest } = require('./authorizeRequest/authorizeRequest');
const { getOrCreateObject } = require('./getOrCreateObject/getOrCreateObject');
const { getProtectedSites } = require('./authorizeRequest/getProtectedSites');

const s3 = new S3();

// Cache protected sites to reduce DynamoDB calls.
// Values declared outside of the handler function are reused for the lifetime of the container.
const cachedProtectedSites = {};
const cacheInterval = 60000; // one minute in milliseconds

exports.handler = async (event) => {
  // Output the event details to CloudWatch Logs.
  // console.log("Event:\n", JSON.stringify(event, null, 2));

  // Retrieve the operation context object from the event.
  // This contains the info for the WriteGetObjectResponse request.
  const { userRequest, getObjectContext } = event;
  const { outputRoute, outputToken } = getObjectContext;

  console.log('userRequest:\n', JSON.stringify(userRequest, null, 2));

  // Create the parameters for the WriteGetObjectResponse request.
  const params = {
    RequestRoute: outputRoute,
    RequestToken: outputToken,
  };

  // Get the protected sites, either from the cached value or from DynamoDB.
  const now = Date.now();
  if (Object.keys(cachedProtectedSites).length === 0 || now - cachedProtectedSites.timestamp > cacheInterval) {
    // Load the protected sites from DynamoDB.
    console.log('Loading protected sites from DynamoDB');
    cachedProtectedSites.sites = await getProtectedSites();
    cachedProtectedSites.timestamp = now;
  } else {
    console.log('didnt need to load protected sites from DynamoDB because they were cached');
  }

  // Get the domain from the forwarded host, is this going to be reliable?
  const forwardedHost = userRequest.headers['X-Forwarded-Host'] ?? '';
  const domain = forwardedHost.split(', ')[0];

  // This is repeated from authorizeRequest.js, should probably be refactored.
  // Parse the path segments from the URL to check if this is a protected site.
  const pathSegments = new URL(userRequest.url).pathname.split('/');
  // If the 'files' segment is the second segment, this is a root site.
  const isRootSite = pathSegments.indexOf('files') === 1;
  const sitePath = isRootSite ? domain : `${domain}/${pathSegments[1]}`;

  // Check if the site is protected.
  const siteRule = cachedProtectedSites.sites.find((site) => Object.keys(site)[0] === sitePath);

  // Check access restrictions.
  // Unrestricted items are always allowed, and should be sent with a cache control header to tell CloudFront to cache the item.
  // Will need to account for whole site protections here.
  const isPublic = !userRequest.url.includes('__restricted') && !siteRule;

  // Check if the user is authorized to access the object (always true for public items).
  const authorized = isPublic ? true : await authorizeRequest(userRequest, siteRule);

  // If the user is not authorized, return a 403 Forbidden response.
  if (!authorized) {
    // If the user is not authorized, return a 403 Access Denied response.
    params.StatusCode = 403;
    params.ErrorMessage = 'Access Denied';

    await s3.writeGetObjectResponse(params);

    // Exit the Lambda function (the status code is for the lambda, not the user response).
    return { statusCode: 200 };
  }

  // If the user is authorized, try to get the object from S3.
  const response = await getOrCreateObject(userRequest, domain);

  // If the object is not found, return a 404 Not Found response.
  if (response.Code === 'NoSuchKey') {
    params.ErrorMessage = 'Not Found';
    params.StatusCode = 404;
  } else {
    // If the object is found, return its data with a 200 OK response.
    params.Body = response.Body;
    params.CacheControl = isPublic ? 'max-age=300' : 'max-age=0';
    params.ContentType = response.ContentType ?? undefined;
    params.ContentLength = response.ContentLength ?? undefined;
    params.ContentRange = response.ContentRange ?? undefined;
    params.AcceptRanges = response.AcceptRanges ?? undefined;
    params.Connection = response.Connection ?? undefined;
  }

  await s3.writeGetObjectResponse(params);

  // Exit the Lambda function.
  return { statusCode: 200 };
};
