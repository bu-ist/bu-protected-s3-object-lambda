/* eslint-disable import/no-unresolved */
const { S3 } = require('aws-sdk');
const { resizeAndSave } = require('./resizeAndSave');

const bucketName = process.env.ORIGINAL_BUCKET;

const s3 = new S3();

// Try to get an object from S3, and return either the valid response, or the error.
async function tryGetObject(s3Key) {
  let response;
  try {
    response = await s3.getObject({
      Bucket: bucketName,
      Key: s3Key,
    }).promise();
  } catch (error) {
    return error;
  }
  return response;
}

async function getOrCreateObject(url) {
  const parsedUrl = new URL(url);
  const { pathname } = parsedUrl;
  // The s3 key is the pathname without the leading slash.
  const s3Key = pathname.replace(/^\//, '');

  console.log('Getting object', s3Key);

  const response = await tryGetObject(s3Key);

  // if the image is not found, and there is a size match, then resize the image and save it to S3.
  const sizeMatch = s3Key.match(/-(\d+)x(\d+)\.(jpg|png)$/);
  if (response.code === 'NoSuchKey' && sizeMatch) {
    console.log('Resizing image');
    // Reconstruct what the original image s3 key would be, by removing the image size from the URL.
    const originalKey = s3Key.replace(/-(\d+)x(\d+)\.(jpg|png)$/, '.$3');

    const originalResponse = await tryGetObject(originalKey);
    // If there's no original image, then return the 404 response.
    if (originalResponse.code === 'NoSuchKey') {
      console.log('Original image not found');
      return response;
    }
    // If there is an original, resize the image data with sharp and save it for future requests.
    const resized = await resizeAndSave(originalResponse, originalKey, sizeMatch, bucketName);
    // Return the resized image response, formatted as an S3 getObject response.
    return {
      Body: resized,
      ContentType: originalResponse.ContentType,
    };
  }

  // Whether an error or a valid response, return it.
  return response;
}

module.exports = { getOrCreateObject };
