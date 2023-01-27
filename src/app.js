// first example here: https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html

const { S3 } = require("aws-sdk");
const axios = require("axios").default;  // Promise-based HTTP requests
const sharp = require("sharp"); // Used for image resizing
const { authorizeRequest } = require('./authorizeRequest/authorizeRequest.js');

const s3 = new S3();

const underlyingOriginalBucket = process.env.UNDERLYING_ORIGINAL_BUCKET;

exports.handler = async (event) => {
  // Output the event details to CloudWatch Logs.
  //console.log("Event:\n", JSON.stringify(event, null, 2));

  // Retrieve the operation context object from the event.
  // This contains the info for the WriteGetObjectResponse request.
  // Includes a presigned URL in `inputS3Url` to download the requested object.
  const { userRequest, getObjectContext } = event;
  const { outputRoute, outputToken, inputS3Url } = getObjectContext;

  // Get image stored in S3 accessible via the presigned URL `inputS3Url`.
  const { data, headers, status } = await axios.get(inputS3Url, {
    responseType: "arraybuffer",
    validateStatus: (status) => status < 500, // Reject only if the status code is greater than or equal to 500
  });

  // Resize the image
  // Height is optional, will automatically maintain aspect ratio.
  // withMetadata retains the EXIF data which preserves the orientation of the image.
  //const resized = await sharp(data).resize({ width: 100, height: 100 }).withMetadata();

  // Detect requests for resized images.
  // Detect the presence of image sizes -100x100.jpg or -100x100.png in the URL.
  const sizeMatch = userRequest.url.match(/-(\d+)x(\d+)\.(jpg|png)$/);

  // Send the resized image back to S3 Object Lambda, if resizing.
  // Right now, just send the original image back for public or authorized requests.
  const params = {
    RequestRoute: outputRoute,
    RequestToken: outputToken,
  };
  
  // If the image is not found, and there is a valid sizeMatch, try loading the original image.
  if (status === 404 && sizeMatch) {
    // Reconstruct what the original image s3 key would be.
    const originalUrl = userRequest.url.replace(/-(\d+)x(\d+)\.(jpg|png)$/, '.$3');
    const parsedUrl = new URL(originalUrl);
    const { pathname } = parsedUrl;
    // The s3 key is the pathname without the leading slash.
    const s3Key = pathname.replace(/^\//, '');

    // Get the width and height from the sizeMatch as integers.
    const width = parseInt( sizeMatch[1], 10 );
    const height = parseInt( sizeMatch[2], 10 );

    // Get the original image data from S3, through the underlying bucket not the access point.
    const data = await s3.getObject({ Bucket: underlyingOriginalBucket, Key: s3Key }).promise();
    
    // Resize the image data with sharp.
    const resized = await sharp(data.Body).resize({ width: width, height: height }).withMetadata();

    // Strip file extension from the original s3Key.
    const s3KeyWithoutExtension = s3Key.replace(/\.[^/.]+$/, "");

    // Get the resized image data as a buffer.
    const resizedBuffer = await resized.toBuffer();

    // Save the resized image to S3, next to the original image.
    await s3.putObject({ 
      Bucket: underlyingOriginalBucket,
      Key: `${s3KeyWithoutExtension}-${width}x${height}.${sizeMatch[3]}`,
      Body: resizedBuffer,
      ContentType: data.ContentType,
    }).promise();

    // Return the resized image back to S3 Object Lambda.
    // Set the content type of the resized image.
    params.ContentType = data.ContentType;
    // Set the body of the response to the resized image data.
    params.Body = await resized;
    // Set the cache control header for the response.
    params.CacheControl = 'max-age=300';
    // Send the response to S3 Object Lambda.
    await s3.writeGetObjectResponse(params).promise();

    // Exit the Lambda function.
    return { statusCode: 200 };

  }

  // If the image is not found, return a 404 Not Found response.
  if (status === 404) {
    params.ErrorMessage = 'Not Found';
    params.StatusCode = 404;
    await s3.writeGetObjectResponse(params).promise();
    return { statusCode: 200 };
  }

  // Unrestricted items are always allowed, and should be sent with a cache control header to tell CloudFront to cache the image.
  // Will need to account for whole site protections here.
  const isPublic = !userRequest.url.includes('__restricted');

  // Check if the user is authorized to access the object (always true for public items).
  const authorized = isPublic ? true : await authorizeRequest(userRequest);

  if (authorized) {
    // If the user is authorized, return image.
    params.Body = data;
    params.ContentType = headers["content-type"];
    // Set the cache control header for the response, never cache private items.
    params.CacheControl = isPublic ? 'max-age=300' : 'max-age=0'; 
  } else {
    // If the user is not authorized, return a 403 Access Denied response.
    params.ErrorMessage = 'Access Denied';
    params.StatusCode = 403;
  }

  await s3.writeGetObjectResponse(params).promise();

  // Exit the Lambda function.
  return { statusCode: 200 };
};
