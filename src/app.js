// first example here: https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html

const { S3 } = require('aws-sdk');

const { authorizeRequest } = require('./authorizeRequest/authorizeRequest');
const { getOrCreateObject } = require('./getOrCreateObject/getOrCreateObject');

const s3 = new S3();

exports.handler = async (event) => {
  // Output the event details to CloudWatch Logs.
  //console.log("Event:\n", JSON.stringify(event, null, 2));

  // Retrieve the operation context object from the event.
  // This contains the info for the WriteGetObjectResponse request.
  const { userRequest, getObjectContext } = event;
  const { outputRoute, outputToken } = getObjectContext;

  // Create the parameters for the WriteGetObjectResponse request.
  const params = {
    RequestRoute: outputRoute,
    RequestToken: outputToken,
  };

  // Check access restrictions.
  // Unrestricted items are always allowed, and should be sent with a cache control header to tell CloudFront to cache the image.
  // Will need to account for whole site protections here.
  const isPublic = !userRequest.url.includes('__restricted');

  // Check if the user is authorized to access the object (always true for public items).
  const authorized = isPublic ? true : await authorizeRequest(userRequest);

  // If the user is not authorized, return a 403 Forbidden response.
  if (!authorized) {
    // If the user is not authorized, return a 403 Access Denied response.
    params.StatusCode = 403;
    params.ErrorMessage = 'Access Denied';

    await s3.writeGetObjectResponse(params).promise();

    // Exit the Lambda function (the status code is for the lambda, not the user response).
    return { statusCode: 200 };
  }

  // Append the domain name to the object key.
  // This is required for the S3 getObject request.
  // Get the domain from the forwarded host, is this going to be reliable?
  const forwardedHost = userRequest.headers['X-Forwarded-Host'] ?? '';
  const domain = forwardedHost.split(', ')[0];

  // If the user is authorized, try to get the object from S3.
  const response = await getOrCreateObject(userRequest.url, domain);

  // If the image is not found, return a 404 Not Found response.
  if (response.code === 'NoSuchKey') {
    params.ErrorMessage = 'Not Found';
    params.StatusCode = 404;
  } else {
    // If the image is found, return the image data with a 200 OK response.
    params.Body = response.Body;
    params.ContentType = response.ContentType;
    params.CacheControl = isPublic ? 'max-age=300' : 'max-age=0';
  }

  await s3.writeGetObjectResponse(params).promise();

  // Exit the Lambda function.
  return { statusCode: 200 };
};
