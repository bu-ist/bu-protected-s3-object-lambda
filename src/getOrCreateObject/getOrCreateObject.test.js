const { mockClient } = require('aws-sdk-client-mock');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Require the function to test.
const { getOrCreateObject } = require('./getOrCreateObject');

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
        headers: { }
      },
      'www.bu.edu',
    );
    expect(result.Body).toBeDefined();
  });

  it('should return an an object, and parse the crop value', async () => {
    const result = await getOrCreateObject(
      { 
        url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/files/01/example-758x460.jpg?resize-position=left',
        headers: { }
      },
      'www.bu.edu',
    );
    expect(result.Body).toBeDefined();
  });
});
