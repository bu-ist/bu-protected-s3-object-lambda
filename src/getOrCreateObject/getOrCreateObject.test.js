/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Readable } from 'stream';

// Import the function to test.
import { getOrCreateObject } from './getOrCreateObject.js';

process.env.DYNAMODB_TABLE = 'test-table';
process.env.ORIGINAL_BUCKET = 'test-bucket';

// Create a 1 pixel jpg image as a readable stream,
// so that the sharp library has something to resize.
const singlePixelJpgReadable = Readable.from(Buffer.from('/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAoHBwkHBgoJCAkLCwoMDxkQDw4ODx4WFxIZJCAmJSMgIyIoLTkwKCo2KyIjMkQyNjs9QEBAJjBGS0U+Sjk/QD3/2wBDAQsLCw8NDx0QEB09KSMpPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT3/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q==', 'base64'));

// Mock the ddb client.
const ddbMock = mockClient(DynamoDBDocumentClient);
ddbMock.on(GetCommand).resolves({
  Item: {
    sizes: JSON.stringify({ thumbnail: { width: 150, height: 150, crop: ['top'] } }),
  },
});

// Mock the s3 client.
const s3Mock = mockClient(S3Client);

// Reject all GetObjectCommand calls by default.
s3Mock.on(GetObjectCommand).rejects({ Code: 'NoSuchKey' });

// Define an existing object in the bucket, that returns a valid and rescalable image.
s3Mock.on(GetObjectCommand, {
  Bucket: 'test-bucket',
  Key: 'original_media/www.bu.edu/somesite/files/01/exists.jpg',
}).resolves({
  Body: singlePixelJpgReadable,
});

// Define a second object in the bucket with a unicode filename.
s3Mock.on(GetObjectCommand, {
  Bucket: 'test-bucket',
  Key: 'original_media/www.bu.edu/site/files/01/file-with-ñ.jpg',
}).resolves({
  Body: singlePixelJpgReadable,
});

describe('getOrCreateObject', () => {
  it('should return an object if it exists', async () => {
    const result = await getOrCreateObject(
      {
        url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/01/exists.jpg',
        headers: { },
      },
      'www.bu.edu',
    );
    expect(result.Body).toBeDefined();
  });

  it('should find the unscaled original for the request, scale it with the parsed crop value, and return an an object', async () => {
    const result = await getOrCreateObject(
      {
        url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/01/exists-758x460.jpg?resize-position=left',
        headers: { },
      },
      'www.bu.edu',
    );
    expect(result.Body).toBeDefined();
  });

  it('should correctly handle unicode characters', async () => {
    const result = await getOrCreateObject(
      {
        url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/site/files/01/file-with-ñ.jpg',
        headers: { },
      },
      'www.bu.edu',
    );
    expect(result.Body).toBeDefined();
  });
});
