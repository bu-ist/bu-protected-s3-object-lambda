/* eslint-disable import/no-unresolved */
import { S3 } from '@aws-sdk/client-s3';
import { lookupCustomCrop } from './resizeAndSave/lookupCustomCrop.js';
import { resizeAndSave } from './resizeAndSave.js';
import { ORIGINAL_PATH_ROOT, RENDER_PATH_ROOT } from './pathConstants.js';

const s3 = new S3();

// Try to get an object from S3, and return either the valid response, or the error.
async function tryGetObject(userRequest, s3Key) {
  let response;
  try {
    response = await s3.getObject({
      Bucket: process.env.ORIGINAL_BUCKET,
      Key: s3Key,
      Range: userRequest.headers?.Range,
    });
  } catch (error) {
    return error;
  }
  return response;
}

async function getOrCreateObject(userRequest, domain) {
  // Get the pathname from the URL.
  const { url } = userRequest;
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

  // Remove double slashes from the s3 key, in the case of a missing domain....
  // this shouldn't be necessary there has to be a better way.
  s3Key = s3Key.replace(/\/\//g, '/');

  // Try to get the object from S3.
  const response = await tryGetObject(userRequest, s3Key);

  // if the image is not found, and there is a size match, then resize the image and save it to S3.
  if (response.Code === 'NoSuchKey' && sizeMatch) {
    // Reconstruct what the original image s3 key would be, by removing the image size from the URL
    const originalPath = decodedPathname.replace(/-(\d+)x(\d+)\.(jpg|jpeg|png|gif)$/, '.$3');
    const originalKey = `${ORIGINAL_PATH_ROOT}/${domain}${originalPath}`;

    const originalResponse = await tryGetObject(userRequest, originalKey);
    // If there's no original image, then do one more check for a "pre-scaled" original.
    if (originalResponse.Code === 'NoSuchKey') {
      // Run an extra check here to see if this is a "pre-scaled" image in the original media path
      // where the original has the size in the name.
      const prescaledOriginalKey = `${ORIGINAL_PATH_ROOT}/${domain}${decodedPathname}`;
      const prescaledOriginalResponse = await tryGetObject(userRequest, prescaledOriginalKey);

      // This was our last chance to find and image, so return the reponse
      // whether it is a file or a 404
      return prescaledOriginalResponse;
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

export { getOrCreateObject };
