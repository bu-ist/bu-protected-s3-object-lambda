import { S3 } from '@aws-sdk/client-s3';
import { createCommonJS } from 'mlly'; // Only needed for ESM compatibility for sharp.
import { ORIGINAL_PATH_ROOT, RENDER_PATH_ROOT } from './pathConstants.js';
import { streamToString } from './resizeAndSave/streamToString.js';

// Create a CommonJS environment for the sharp module, which is not yet ESM compatible.
// eslint-disable-next-line no-unused-vars
const { __dirname, __filename, require } = createCommonJS(import.meta.url);
// eslint-disable-next-line import/first, import/order
import sharp from 'sharp'; // Used for image resizing

const bucketName = process.env.ORIGINAL_BUCKET;

const s3 = new S3();

// Sharp won't decode an image with more pixels than its limit, 268402689 pixels by default.
// Animated images count every frame toward that limit, so a long animation can exceed it.
const PIXEL_LIMIT_MESSAGE = 'exceeds pixel limit';

// Resize and save the image to S3, then return the resized image data.
// If the image is too large for sharp to resize, return the original image data instead.
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

  // Get the original image data as a buffer.
  // This used to not be necessary but changed with the v3 S3 SDK.
  const imageBuffer = await streamToString(data.Body);

  // Resize the image data with sharp, and get the resized image data as a buffer.
  let resized;
  let resizedBuffer;
  try {
    const image = sharp(imageBuffer, { animated: true });

    // Camera JPEGs often store unrotated pixels plus an EXIF Orientation tag, and WordPress
    // names and sizes sub-sizes for the oriented image. rotate() with no angle applies the tag
    // before the resize and crop, and resets it so browsers don't rotate the output again.
    // It has to come before resize(): after it, sharp keeps the original tag whenever JPEG
    // shrink-on-load reloads the input. WordPress applies the tag to JPEGs only
    // (WP_Image_Editor::maybe_exif_rotate()), so other formats, and JPEGs with no rotation or
    // flip to apply, keep their pipeline unchanged.
    const { format, orientation } = await image.metadata();
    if (format === 'jpeg' && orientation > 1) {
      image.rotate();
    }

    resized = await image.resize({
      width,
      height,
      ...options,
    }).withMetadata();

    resizedBuffer = await resized.toBuffer();
  } catch (error) {
    // Anything other than the pixel limit is unexpected, so let it propagate.
    if (!error?.message?.includes(PIXEL_LIMIT_MESSAGE)) {
      throw error;
    }

    // This image can't be resized, so serve the original unscaled for this request.
    // Nothing is saved to S3, because there is no resized image to save.
    console.log('Resize skipped, the image exceeds the sharp pixel limit: ', originalPath);

    return imageBuffer;
  }

  // Strip file extension from the original s3Key.
  const pathWithoutExtension = originalPath.replace(/\.[^/.]+$/, '');

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
  });

  return resized;
}

export { resizeAndSave };
