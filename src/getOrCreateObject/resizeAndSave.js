const { S3 } = require('aws-sdk');
const sharp = require('sharp'); // Used for image resizing

const bucketName = process.env.ORIGINAL_BUCKET;

const { ORIGINAL_PATH_ROOT, RENDER_PATH_ROOT } = require('./pathConstants');

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
async function resizeAndSave(data, originalPath, sizeMatch, crop) {
  // Get the width and height from the sizeMatch as integers.
  const width = parseInt(sizeMatch[1], 10);
  const height = parseInt(sizeMatch[2], 10);

  // Only set custom options if the crop query param is set.
  // We should probably validate the crop query param here.....
  const options = !crop ? {} : {
    fit: 'cover',
    position: sharp.position[crop],
  };

  // Resize the image data with sharp.
  const resized = await sharp(data.Body).resize({
    width,
    height,
    ...options,
  }).withMetadata();

  // Strip file extension from the original s3Key.
  const pathWithoutExtension = originalPath.replace(/\.[^/.]+$/, '');

  // Get the resized image data as a buffer.
  const resizedBuffer = await resized.toBuffer();

  // Encode the original path, so that it can be used in the metadata.
  const encodedPath = encodeURI(originalPath);

  // Save the resized image to S3, next to the original image.
  await s3.putObject({
    Bucket: bucketName,
    Key: `${RENDER_PATH_ROOT}${pathWithoutExtension}-${width}x${height}${crop ? `*crop-${crop}` : ''}.${sizeMatch[3]}`,
    Body: resizedBuffer,
    ContentType: data.ContentType,
    Metadata: {
      'original-key': `${ORIGINAL_PATH_ROOT}${encodedPath}`,
    },
  }).promise();

  return resized;
}

module.exports = { getOriginalS3Key, resizeAndSave };
