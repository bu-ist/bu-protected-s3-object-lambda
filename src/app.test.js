import { describe, it, expect } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

// Import the function to test.
import { handler } from './app.js';

const ddbMock = mockClient(DynamoDBDocumentClient);
const ssmMock = mockClient(SSMClient);

process.env.DYNAMODB_TABLE = 'test-table';
process.env.RANGES_SSM_PARAMETER_NAME = 'test-parameter';
process.env.ORIGINAL_BUCKET = 'test-bucket';

// Mock the ddb client.
ddbMock.on(GetCommand, {
  Key: { PK: 'PROTECTED_SITES' },
}).resolves({
  Item: {
    ProtectedSites: JSON.stringify([
      { 'example.host.bu.edu/protected': 'somegroup' },
      { 'example.host.bu.edu/also-protected': 'anothergroup' },
      { 'rootsite.bu.edu': 'somegroup' },
    ]),
  },
}).on(GetCommand, {
  Key: { PK: 'example.host.bu.edu/protected#somegroup' },
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

// Mock the ssm client.
ssmMock.on(GetParameterCommand).resolves({
  Parameter: {
    Value: JSON.stringify([
      { localhost: { start: '127.0.0.0', end: '127.0.0.2', cidrs: [] } },
    ]),
  },
});

// Mock the s3 client, by default just return a valid object for any get request.
const s3Mock = mockClient(S3Client);
s3Mock.on(GetObjectCommand).resolves({
  Body: 'test',
});

// Add a more specific mocked S3 event for a non-existent object.
s3Mock.on(GetObjectCommand, {
  Bucket: process.env.ORIGINAL_BUCKET,
  Key: 'original_media/example.host.bu.edu/site/files/01/no-such-file.jpg',
}).rejects({ Code: 'NoSuchKey' });

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
      'Shib-Handler': 'https://example.host.bu.edu/saml/wp-app/shibboleth',
    },
  },
  getObjectContext: {
    outputRoute: 'test',
    outputToken: 'test',
  },
};

const nonExistentObjectEvent = {
  userRequest: {
    url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/site/files/01/no-such-file.jpg',
    headers: {
      'X-Forwarded-Host': 'example.host.bu.edu',
    },
  },
  getObjectContext: {
    outputRoute: 'test',
    outputToken: 'test',
  },
};

const forbiddenEvent = {
  userRequest: {
    url: 'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/protected/files/01/example.jpg',
    headers: {
      Eppn: 'valid-but-unauthorized@bu.edu',
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

  // The Lambda returns a 200 response for everything as long as the Lambda itself doesn't crash.
  // Which makes it a little hard to test, but this tests that protected media requests don't crash.
  it('should return a 200 response for protected media request', async () => {
    const result = await handler(protectedSiteEvent);
    expect(result.statusCode).toEqual(200);
  });

  // Non-existent objects return a 200 response.
  // We need to return a 200 response because we have to return a real html page,
  // and the only way to return a real html page is to return a 200 response.
  it('should return a 200 response for non-existent object', async () => {
    const result = await handler(nonExistentObjectEvent);
    expect(result.statusCode).toEqual(200);
  });

  // Forbidden requests return a 200 response.
  // Hard to test, but the s3.writeGetObjectResponse should be a forbidden response.
  it('should return a 200 response for forbidden request', async () => {
    const result = await handler(forbiddenEvent);
    expect(result.statusCode).toEqual(200);
  });
});
