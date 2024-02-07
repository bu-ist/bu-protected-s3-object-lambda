/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expect } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Import the function to test.
import { getOrCreateObject } from './getOrCreateObject.js';

process.env.DYNAMODB_TABLE = 'test-table';

// Mock the ddb client.
const ddbMock = mockClient(DynamoDBDocumentClient);
ddbMock.on(GetCommand).resolves({
  Item: {
    sizes: JSON.stringify({ thumbnail: { width: 150, height: 150, crop: ['top'] } }),
  },
});

// Mock the s3 client.
const s3Mock = mockClient(S3Client);
s3Mock.on(GetObjectCommand).resolves({
  Body: 'test',
});

describe('getOrCreateObject', () => {
  it('should return an object', async () => {
    const result = await getOrCreateObject(
      {
        url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/01/example-150x150.jpg',
        headers: { },
      },
      'www.bu.edu',
    );
    expect(result.Body).toBeDefined();
  });

  it('should return an an object, and parse the crop value', async () => {
    const result = await getOrCreateObject(
      {
        url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/files/01/example-758x460.jpg?resize-position=left',
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
