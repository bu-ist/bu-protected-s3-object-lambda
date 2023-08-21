const { mockClient } = require('aws-sdk-client-mock');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');

// Require the function to test.
const { handler } = require('./app');

// Mock the s3 client.
const s3Mock = mockClient(S3Client);
s3Mock.on(GetObjectCommand).resolves({
  Body: 'test',
});

const publicMediaEvent = {
  userRequest: {
    url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/01/example.jpg',
    headers: {
      'X-Forwarded-Host': 'www.bu.edu',
    },
  },
  getObjectContext: {
    outputRoute: 'test',
    outputToken: 'test',
  },
};

describe('handler', () => {
  it('should return a 200 response for public media request', async () => {
    const result = await handler(publicMediaEvent);
    expect(result.statusCode).toEqual(200);
  });
});
