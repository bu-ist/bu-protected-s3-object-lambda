// first example here: https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html

const { S3 } = require("aws-sdk");
const axios = require("axios").default;  // Promise-based HTTP requests
//const sharp = require("sharp"); // Used for image resizing
const { authorizeRequest } = require('./authorizeRequest/authorizeRequest.js');

const s3 = new S3();

exports.handler = async (event) => {
  // Output the event details to CloudWatch Logs.
  //console.log("Event:\n", JSON.stringify(event, null, 2));

  // Retrieve the operation context object from the event.
  // This contains the info for the WriteGetObjectResponse request.
  // Includes a presigned URL in `inputS3Url` to download the requested object.
  const { userRequest, getObjectContext } = event;
  const { outputRoute, outputToken, inputS3Url } = getObjectContext;

  // Check if the user is authorized to access the object.
  const authorized = await authorizeRequest(userRequest);

  // Get image stored in S3 accessible via the presigned URL `inputS3Url`.
  const { data, headers } = await axios.get(inputS3Url, { responseType: "arraybuffer" });

  // Resize the image
  // Height is optional, will automatically maintain aspect ratio.
  // withMetadata retains the EXIF data which preserves the orientation of the image.
  //const resized = await sharp(data).resize({ width: 100, height: 100 }).withMetadata();

  // Send the resized image back to S3 Object Lambda, if resizing.
  // Right now, just send the original image back for public or authorized requests.
  const params = {
    RequestRoute: outputRoute,
    RequestToken: outputToken,
  };

  if (authorized) {
    // If the user is authorized, return image.
    params.Body = data;
    params.ContentType = headers["content-type"];
  } else {
    // If the user is not authorized, return a 403 Access Denied response.
    params.Body = 'Access Denied';
    params.StatusCode = 403;
    params.ContentType = 'text/plain';
  }

  await s3.writeGetObjectResponse(params).promise();

  // Exit the Lambda function.
  return { statusCode: 200 };
};
