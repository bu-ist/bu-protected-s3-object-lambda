const { S3 } = require('aws-sdk');
const sharp = require('sharp'); // Used for image resizing

const s3 = new S3();

function getOriginalS3Key(url) {
  // Reconstruct what the original image s3 key would be, by removing the image size from the URL.
  const originalUrl = url.replace(/-(\d+)x(\d+)\.(jpg|png)$/, '.$3');
  const parsedUrl = new URL(originalUrl);
  const { pathname } = parsedUrl;
  // The s3 key is the pathname without the leading slash.
  const s3Key = pathname.replace(/^\//, '');

  return s3Key;
}

// Resize and save the image to S3, then return the resized image data.
async function resizeAndSave(data, s3Key, sizeMatch, originalBucket) {
  // Get the width and height from the sizeMatch as integers.
  const width = parseInt(sizeMatch[1], 10);
  const height = parseInt(sizeMatch[2], 10);

  // Resize the image data with sharp.
  const resized = await sharp(data.Body).resize({ width: width, height: height }).withMetadata();

  // Strip file extension from the original s3Key.
  const s3KeyWithoutExtension = s3Key.replace(/\.[^/.]+$/, '');

  // Get the resized image data as a buffer.
  const resizedBuffer = await resized.toBuffer();

  // Save the resized image to S3, next to the original image.
  await s3.putObject({
    Bucket: originalBucket,
    Key: `${s3KeyWithoutExtension}-${width}x${height}.${sizeMatch[3]}`,
    Body: resizedBuffer,
    ContentType: data.ContentType,
    Metadata: {
      'original-key': s3Key,
    },
  }).promise();

  return resized;
}

module.exports = { getOriginalS3Key, resizeAndSave };
