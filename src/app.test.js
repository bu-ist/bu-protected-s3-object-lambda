const { mockClient } = require('aws-sdk-client-mock');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Require the function to test.
const { handler } = require('./app');

const ddbMock = mockClient(DynamoDBDocumentClient);

process.env.DYNAMODB_TABLE = 'test-table';

// Mock the ddb client.
ddbMock.on(GetCommand, {
  Key: { SiteAndGroupKey: 'PROTECTED_SITES' },
}).resolves({
  Item: {
    ProtectedSites: JSON.stringify([
      { 'example.host.bu.edu/protected': 'somegroup' },
      { 'example.host.bu.edu/also-protected': 'anothergroup' },
      { 'rootsite.bu.edu': 'somegroup' },
    ]),
  },
}).on(GetCommand, {
  Key: { SiteAndGroupKey: 'example.host.bu.edu/protected#somegroup' },
}).resolves({
  Item: {
    rules: JSON.stringify({
      users: ['user1', 'user2', 'test', 'test2'],
      states: ['faculty', 'staff'],
      entitlements: ['https://iam.bu.edu/reg/college/com'],
      ranges: ['crc'],
      satisfy_all: false,
    }),
  },
});

// Mock the s3 client; this just returns a valid object for any get request.
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

const protectedSiteEvent = {
  userRequest: {
    url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/protected/files/01/example.jpg',
    headers: {
      'X-Forwarded-Host': 'example.host.bu.edu',
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

// The Lambda returns a 200 response for everything as long as the Lambda itself doesn't crash.
// Which makes it a little hard to test, but this tests that protected media requests don't crash.
it('should return a 200 response for protected media request', async () => {
  const result = await handler(protectedSiteEvent);
  expect(result.statusCode).toEqual(200);
});
