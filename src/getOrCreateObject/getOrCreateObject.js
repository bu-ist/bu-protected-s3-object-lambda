/* eslint-disable import/no-unresolved */
const {
  S3
} = require("@aws-sdk/client-s3");
const { lookupCustomCrop } = require('./resizeAndSave/lookupCustomCrop');
const { resizeAndSave } = require('./resizeAndSave');

const bucketName = process.env.ORIGINAL_BUCKET;

const { ORIGINAL_PATH_ROOT, RENDER_PATH_ROOT } = require('./pathConstants');

const s3 = new S3();

// Try to get an object from S3, and return either the valid response, or the error.
async function tryGetObject(s3Key) {
  let response;
  try {
    response = await s3.getObject({
      Bucket: bucketName,
      Key: s3Key,
    });
  } catch (error) {
    return error;
  }
  return response;
}

async function getOrCreateObject(url, domain) {
  // Get the pathname from the URL.
  const { pathname, searchParams } = new URL(url);
  // Get the size match from the pathname.
  const sizeMatch = pathname.match(/-(\d+)x(\d+)\.(jpg|jpeg|png|gif)$/);

  // Decode the pathname for unicode characters.
  const decodedPathname = decodeURIComponent(pathname);

  // Get the crop related query parameters from the URL.
  const paramCrop = searchParams.get('resize-position') ?? false;

  // Get any crop rules that may match the database.
  const dbCropResponse = await lookupCustomCrop(url, domain, sizeMatch);

  const dbCrop = dbCropResponse ? dbCropResponse.crop : false;

  let dbCropString = '';
  if (Array.isArray(dbCrop)) {
    dbCropString = dbCrop.filter((position) => ['top', 'bottom', 'left', 'right'].includes(position)).toString();
  }

  // If there is a crop query param, use it, otherwise use the crop from the database.
  const crop = paramCrop || dbCropString;

  // The s3 key is dependent on whether the image is an original or a render.
  // Prepend the appropriate path root to the pathname, based on the sizeMatch.
  let s3Key = `${sizeMatch ? RENDER_PATH_ROOT : ORIGINAL_PATH_ROOT}/${domain}${decodedPathname}`;

  // If there is a crop query param, add it to the s3 key.
  if (crop) {
    const pathWithoutExtension = decodedPathname.replace(/\.[^/.]+$/, '');
    s3Key = `${RENDER_PATH_ROOT}/${domain}${pathWithoutExtension}*crop-${crop}.${sizeMatch[3]}`;
  }

  // Remove double slashes from the s3 key, in the case of a missing domain.... this shouldn't be necessary there has to be a better way.
  s3Key = s3Key.replace(/\/\//g, '/');

  console.log('s3Key:', s3Key);

  // Try to get the object from S3.
  const response = await tryGetObject(s3Key);

  // if the image is not found, and there is a size match, then resize the image and save it to S3.
  if (response.code === 'NoSuchKey' && sizeMatch) {
    // Reconstruct what the original image s3 key would be, by removing the image size from the URL.
    const originalPath = decodedPathname.replace(/-(\d+)x(\d+)\.(jpg|jpeg|png|gif)$/, '.$3');
    const originalKey = `${ORIGINAL_PATH_ROOT}/${domain}${originalPath}`;

    const originalResponse = await tryGetObject(originalKey);
    // If there's no original image, then return the 404 response.
    if (originalResponse.code === 'NoSuchKey') {
      return response;
    }
    // If there is an original, resize the image data with sharp and save it for future requests.
    const resized = await resizeAndSave(originalResponse, `/${domain}${originalPath}`, sizeMatch, crop);
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
