const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const ddbMock = mockClient(DynamoDBDocumentClient);

const { lookupCustomCrop } = require('./lookupCustomCrop');

// Table name is not relevant for these tests, but has to exist for the mocked ddb client.
process.env.DYNAMODB_TABLE = 'test-table';

// Mock the ddb client.
ddbMock.on(GetCommand).resolves({
  Item: {
    sizes: JSON.stringify({ thumbnail: { width: 150, height: 150, crop: ['top'] } }),
  },
});

describe('lookupCustomCrop', () => {
  it('should return a custom crop from dynamodb for a given image', async () => {
    const result = await lookupCustomCrop(
      'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/01/example-150x150.jpg',
      'www.bu.edu',
      [
        '-150x150.jpg', '150', '150', 'jpg',
      ],
    );

    const { crop } = result;

    expect(crop[0]).toBe('top');
  });

  it('should return return no crop', async () => {
    const result = await lookupCustomCrop(
      'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/01/example-255x255.jpg',
      'www.bu.edu',
      [
        '-255x255.jpg', '255', '255', 'jpg',
      ],
    );

    expect(result).toBe(undefined);
  });
});
