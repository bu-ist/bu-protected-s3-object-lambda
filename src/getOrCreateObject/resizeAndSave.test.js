/* eslint-disable import/no-extraneous-dependencies */
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Import the function to test.
// Vitest hoists the vi.hoisted() and vi.mock() calls below above this import,
// so the bucket name is set and sharp is mocked before resizeAndSave.js loads.
import { resizeAndSave } from './resizeAndSave.js';

// resizeAndSave.js reads the bucket name once, when it loads.
vi.hoisted(() => {
  process.env.ORIGINAL_BUCKET = 'test-bucket';
});

// Mock sharp, so that these tests can make the resize succeed or fail on demand.
// These tests cover our own fallback logic, not sharp's image processing.
// getOrCreateObject.test.js still runs the real sharp library against real image bytes.
const { sharpMock, sharpPipeline } = vi.hoisted(() => {
  // sharp's resize() and withMetadata() return the pipeline, so that calls can be chained.
  const pipeline = {};
  pipeline.resize = vi.fn(() => pipeline);
  pipeline.withMetadata = vi.fn(() => pipeline);
  pipeline.toBuffer = vi.fn(async () => Buffer.from('resized-image-bytes'));

  const sharpFn = vi.fn(() => pipeline);
  // resizeAndSave reads sharp.position when a crop is requested.
  sharpFn.position = {
    top: 1, right: 2, bottom: 3, left: 4, centre: 5,
  };

  return { sharpMock: sharpFn, sharpPipeline: pipeline };
});

vi.mock('sharp', () => ({ default: sharpMock }));

// Mock the s3 client.
const s3Mock = mockClient(S3Client);

// A size match for a 150x150 gif, in the shape the regex in getOrCreateObject produces.
const sizeMatch = ['-150x150.gif', '150', '150', 'gif'];

// Build a getObject response, with the image bytes as a readable stream.
const s3Response = (bytes) => ({
  Body: Readable.from(Buffer.from(bytes)),
  ContentType: 'image/gif',
});

describe('resizeAndSave', () => {
  beforeEach(() => {
    s3Mock.reset();
    s3Mock.on(PutObjectCommand).resolves({});
    vi.clearAllMocks();
  });

  it('should resize the image, save it to S3, and return the sharp pipeline', async () => {
    const result = await resizeAndSave(
      s3Response('original-image-bytes'),
      '/www.bu.edu/somesite/files/01/example.gif',
      sizeMatch,
      false,
    );

    // The original bytes and the animated flag go to sharp,
    // and the dimensions parsed from the size match go to resize.
    expect(sharpMock).toHaveBeenCalledWith(Buffer.from('original-image-bytes'), { animated: true });
    expect(sharpPipeline.resize).toHaveBeenCalledWith({ width: 150, height: 150 });

    // The resized bytes are saved for future requests, under the size suffixed key.
    const putCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input).toEqual({
      Bucket: 'test-bucket',
      Key: 'rendered_media/www.bu.edu/somesite/files/01/example-150x150.gif',
      Body: Buffer.from('resized-image-bytes'),
      ContentType: 'image/gif',
      Metadata: {
        'original-key': 'original_media/www.bu.edu/somesite/files/01/example.gif',
      },
    });

    // The pipeline itself is returned, for the caller to use as the response body.
    expect(result).toBe(sharpPipeline);
  });

  it('should return the original image and save nothing when it exceeds the pixel limit', async () => {
    // This is the error sharp throws for an image with more pixels than its limit.
    // Animated images can hit it because every frame counts toward the limit.
    sharpPipeline.toBuffer.mockRejectedValueOnce(new Error('Input image exceeds pixel limit'));

    const result = await resizeAndSave(
      s3Response('too-many-pixels'),
      '/www.bu.edu/somesite/files/01/huge.gif',
      sizeMatch,
      false,
    );

    // The original, unresized bytes are returned.
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe('too-many-pixels');

    // Nothing is saved to S3, because there is no resized image to save.
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

  it('should rethrow any other resize failure', async () => {
    sharpPipeline.toBuffer.mockRejectedValueOnce(new Error('Input buffer contains unsupported image format'));

    await expect(resizeAndSave(
      s3Response('not-an-image'),
      '/www.bu.edu/somesite/files/01/broken.gif',
      sizeMatch,
      false,
    )).rejects.toThrow('unsupported image format');

    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

  it('should resize with the crop position and include the crop in the saved key', async () => {
    await resizeAndSave(
      s3Response('original-image-bytes'),
      '/www.bu.edu/somesite/files/01/example.gif',
      sizeMatch,
      'top',
    );

    expect(sharpPipeline.resize).toHaveBeenCalledWith({
      width: 150,
      height: 150,
      fit: 'cover',
      position: sharpMock.position.top,
    });

    expect(s3Mock.commandCalls(PutObjectCommand)[0].args[0].input.Key)
      .toBe('rendered_media/www.bu.edu/somesite/files/01/example-150x150*crop-top.gif');
  });
});

// This is the guard for the message matched in resizeAndSave.
// The message comes from sharp's native code, so a sharp upgrade could change it.
// limitInputPixels provokes the same error from a tiny image, with no large fixture needed.
describe('the sharp pixel limit error', () => {
  it('should still contain the message that resizeAndSave matches on', async () => {
    const { default: realSharp } = await vi.importActual('sharp');

    const tinyPng = await realSharp({
      create: {
        width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 },
      },
    }).png().toBuffer();

    await expect(realSharp(tinyPng, { animated: true, limitInputPixels: 1 })
      .resize({ width: 2, height: 2 })
      .withMetadata()
      .toBuffer()).rejects.toThrow('exceeds pixel limit');
  });
});
