/* eslint-disable import/no-extraneous-dependencies */
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Readable } from 'stream';
import sharp from 'sharp';

import { getOrCreateObject } from './getOrCreateObject.js';

// resizeAndSave.js reads the bucket name once, when it loads.
vi.hoisted(() => {
  process.env.DYNAMODB_TABLE = 'test-table';
  process.env.ORIGINAL_BUCKET = 'test-bucket';
});

// These tests run the real sharp library over generated images.
// The displayed image has a different color in each quadrant, so a sideways,
// mirrored or wrongly cropped output differs from the reference by far more than JPEG noise.
const QUADRANT_COLORS = [[220, 30, 30], [30, 200, 60], [30, 60, 220], [240, 220, 40]];

const quadrantColor = (x, y, width, height) => QUADRANT_COLORS[
  (y < height / 2 ? 0 : 2) + (x < width / 2 ? 0 : 1)
];

function quadrants(width, height) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(quadrantColor(x, y, width, height), (y * width + x) * 3);
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } });
}

// Where a stored pixel (x, y) of a w x h stored image appears once displayed, per EXIF orientation.
// 2, 4, 5 and 7 mirror the image; 5 to 8 swap its width and height.
const DISPLAYED_AT = {
  1: (x, y) => [x, y],
  2: (x, y, w) => [w - 1 - x, y],
  3: (x, y, w, h) => [w - 1 - x, h - 1 - y],
  4: (x, y, w, h) => [x, h - 1 - y],
  5: (x, y) => [y, x],
  6: (x, y, w, h) => [h - 1 - y, x],
  7: (x, y, w, h) => [h - 1 - y, w - 1 - x],
  8: (x, y, w) => [y, w - 1 - x],
};

// A camera JPEG that displays as quadrants(width, height): the pixels as the sensor stored them,
// plus the EXIF tag that orients them.
async function cameraJpeg(orientation, width, height) {
  const [storedWidth, storedHeight] = orientation > 4 ? [height, width] : [width, height];
  const data = Buffer.alloc(storedWidth * storedHeight * 3);
  for (let y = 0; y < storedHeight; y += 1) {
    for (let x = 0; x < storedWidth; x += 1) {
      const [displayX, displayY] = DISPLAYED_AT[orientation](x, y, storedWidth, storedHeight);
      data.set(quadrantColor(displayX, displayY, width, height), (y * storedWidth + x) * 3);
    }
  }
  return sharp(data, { raw: { width: storedWidth, height: storedHeight, channels: 3 } })
    .jpeg()
    .withMetadata({ orientation })
    .toBuffer();
}

// Mean absolute difference per channel, 0-255, between two images of the same size.
async function meanDifference(a, b) {
  const [ra, rb] = await Promise.all([a, b].map((image) => sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })));
  expect([ra.info.width, ra.info.height]).toEqual([rb.info.width, rb.info.height]);
  let sum = 0;
  for (let i = 0; i < ra.data.length; i += 1) {
    sum += Math.abs(ra.data[i] - rb.data[i]);
  }
  return sum / ra.data.length;
}

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

// Serve one original from the bucket, and capture what gets saved to rendered_media.
function serveOriginal(name, body, contentType) {
  s3Mock.on(GetObjectCommand, {
    Bucket: 'test-bucket',
    Key: `original_media/www.bu.edu/somesite/files/01/${name}`,
  }).resolves({ Body: Readable.from(body), ContentType: contentType });
}

async function requestSize(name) {
  const result = await getOrCreateObject(
    {
      url: `https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/01/${name}`,
      headers: {},
    },
    'www.bu.edu',
  );
  const putCalls = s3Mock.commandCalls(PutObjectCommand);
  expect(putCalls).toHaveLength(1);
  return { result, saved: putCalls[0].args[0].input };
}

beforeEach(() => {
  s3Mock.reset();
  s3Mock.on(GetObjectCommand).rejects({ Code: 'NoSuchKey' });
  s3Mock.on(PutObjectCommand).resolves({});

  // The site defines a 445x300 size cropped from the top, as a theme's add_image_size() would.
  ddbMock.reset();
  ddbMock.on(GetCommand).resolves({
    Item: {
      sizes: JSON.stringify({ card: { width: 445, height: 300, crop: ['center', 'top'] } }),
    },
  });
});

describe('getOrCreateObject with EXIF-oriented originals', () => {
  // WordPress names sub-sizes for the oriented image: a 1200x1800 portrait's medium is 424x636.
  // The 150x150 and some 445x300 cases make sharp reload the JPEG with shrink-on-load,
  // which is where a rotate() added after resize() leaves the original tag in place.
  const cases = [];
  [1, 2, 3, 4, 5, 6, 7, 8].forEach((orientation) => {
    const portrait = orientation > 4;
    const display = portrait ? [1200, 1800] : [1800, 1200];
    cases.push(
      [orientation, 'medium', ...display, ...(portrait ? [424, 636] : [636, 424]), {}],
      [orientation, 'card', ...display, 445, 300, { fit: 'cover', position: 'top' }],
      [orientation, 'thumbnail', ...display, 150, 150, {}],
    );
  });

  it.each(cases)('should render an orientation %i original upright at its %s size', async (
    orientation,
    _,
    displayWidth,
    displayHeight,
    width,
    height,
    resizeOptions,
  ) => {
    const original = await cameraJpeg(orientation, displayWidth, displayHeight);
    serveOriginal(`photo${orientation}.jpg`, original, 'image/jpeg');

    const { result, saved } = await requestSize(`photo${orientation}-${width}x${height}.jpg`);

    // The 445x300 card size has a top crop in DynamoDB, which goes into the saved key.
    const crop = resizeOptions.position ? `*crop-${resizeOptions.position}` : '';
    expect(saved.Key)
      .toBe(`rendered_media/www.bu.edu/somesite/files/01/photo${orientation}-${width}x${height}${crop}.jpg`);

    const metadata = await sharp(saved.Body).metadata();
    expect([metadata.width, metadata.height]).toEqual([width, height]);
    // Orientation 1 means no rotation is left for the browser to apply.
    expect([undefined, 1]).toContain(metadata.orientation);

    // Crop gravity applies to the upright image.
    const reference = await quadrants(displayWidth, displayHeight)
      .resize({ width, height, ...resizeOptions })
      .png()
      .toBuffer();
    expect(await meanDifference(saved.Body, reference)).toBeLessThan(8);

    // The first response streams the returned pipeline, which must match the saved object.
    expect((await result.Body.toBuffer()).equals(saved.Body)).toBe(true);
  });
});

describe('getOrCreateObject with originals that have no orientation to apply', () => {
  // The output for these must be byte-identical to the pipeline without orientation handling.
  const unrotatedPipeline = (body, options) => sharp(body, { animated: true })
    .resize(options)
    .withMetadata()
    .toBuffer();

  // WordPress applies EXIF orientation to JPEGs only, so a tagged WebP keeps its pixels as stored.
  it.each([
    ['a JPEG with no EXIF', 'plain.jpg', () => quadrants(900, 600).jpeg().toBuffer(), 'image/jpeg', undefined],
    ['an orientation 1 JPEG', 'upright.jpg', () => cameraJpeg(1, 900, 600), 'image/jpeg', 1],
    ['a PNG', 'graphic.png', () => quadrants(900, 600).png().toBuffer(), 'image/png', undefined],
    ['an orientation 6 WebP', 'tagged.webp', () => quadrants(900, 600).webp().withMetadata({ orientation: 6 }).toBuffer(), 'image/webp', 6],
  ])('should resize %s exactly as before', async (_, name, makeOriginal, contentType, orientation) => {
    const original = await makeOriginal();
    expect((await sharp(original).metadata()).orientation).toBe(orientation);
    serveOriginal(name, original, contentType);
    const base = name.replace(/\.[^.]+$/, '');
    const extension = name.split('.').pop();

    const scaled = await requestSize(`${base}-636x424.${extension}`);
    expect(scaled.saved.Body.equals(await unrotatedPipeline(original, {
      width: 636, height: 424,
    }))).toBe(true);

    s3Mock.resetHistory();
    serveOriginal(name, original, contentType);
    const cropped = await requestSize(`${base}-445x300.${extension}`);
    expect(cropped.saved.Body.equals(await unrotatedPipeline(original, {
      width: 445, height: 300, fit: 'cover', position: sharp.position.top,
    }))).toBe(true);
  });
});
