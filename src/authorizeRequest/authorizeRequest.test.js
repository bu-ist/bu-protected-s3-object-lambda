import { describe, it, expect } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

// eslint-disable-next-line import/first
import { authorizeRequest } from './authorizeRequest';

// Table name is not relevant for these tests, but has to exist for the mocked ddb client.
process.env.DYNAMODB_TABLE = 'test-table';

const testRanges = {
  campus1: [
    { start: '10.0.0.0', end: '10.0.0.255', cidrs: [] },
    { start: '10.0.1.0', end: '10.0.1.255', cidrs: [] },
  ],
  campus2: [
    { start: '10.1.0.0', end: '10.1.0.255', cidrs: [] },
    { start: '10.1.1.0', end: '10.1.1.255', cidrs: [] },
  ],
};

// Mock the ddb client.
ddbMock.on(GetCommand, {
  Key: { PK: 'example.host.bu.edu/somesite#somegroup' },
}).resolves({
  Item: {
    rules: JSON.stringify({
      users: ['user1', 'user2', 'test', 'test2', 'some_user'],
      states: ['faculty', 'staff'],
      entitlements: ['https://iam.bu.edu/reg/college/com'],
      ranges: ['campus1'],
      satisfy_all: false,
    }),
  },
}).on(GetCommand, {
  Key: { PK: 'example.host.bu.edu/somesite#othergroup' },
}).resolves({
  Item: {
    rules: JSON.stringify({
      users: ['user1', 'user2', 'test', 'test2'],
      ranges: ['campus1'],
      satisfy_all: true,
    }),
  },
}).on(GetCommand, {
  Key: { PK: 'example.host.bu.edu#somegroup' },
}).resolves({
  Item: {
    rules: JSON.stringify({
      users: ['root_user'],
    }),
  },
});

describe('authorizeRequest', () => {
  // Entire community group tests.
  it('should return true if the user is granted access through the entire community group', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/entire-bu-community/image.jpg',
      headers: {
        Eppn: 'testUser@bu.edu',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(true);
  });

  it('should return false if the user is not logged in and the file is restricted to the entire bu community', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/entire-bu-community/image.jpg',
      headers: {
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(false);
  });

  // User tests.
  it('should return true if the user is granted access by user name', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        Eppn: 'user2@bu.edu',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(true);
  });

  // Affiliation tests.

  // Entitlement tests.

  // Add a test for a root site vs a sub site.
  it('should return true if the user is granted access by user name for the root site', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/files/__restricted/somegroup/image.jpg',
      headers: {
        Eppn: 'root_user@bu.edu',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(true);
  });

  // Network tests.
  it('should return true if the user is granted access by network address', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        'X-Real-Ip': '10.0.0.30',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(true);
  });

  it('should return false if the user is not granted access by network address', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        'X-Real-Ip': '127.0.0.1',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(false);
  });

  it('should return false if the user only has network address access, and satisfy_all is true', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/othergroup/image.jpg',
      headers: {
        'X-Real-Ip': '10.0.0.30',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(false);
  });

  it('should return false if the user is denied access by siteRule', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/2023/08/image.jpg',
      headers: {
        'X-Real-Ip': '127.0.0.1',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const siteRule = {
      'example.host.bu.edu/somesite': 'somegroup',
    };
    const result = await authorizeRequest(userRequest, siteRule, testRanges);
    expect(result).toBe(false);
  });

  it('should return true if the user is granted access by groupName even if denied by siteRule', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        Eppn: 'some_user@bu.edu', // This user should have access to 'somegroup' but not 'othergroup'.
        'X-Real-Ip': '127.0.0.1',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const siteRule = {
      'example.host.bu.edu/somesite': 'othergroup',
    };

    const result = await authorizeRequest(userRequest, siteRule, testRanges);
    expect(result).toBe(true);
  });

  // Check that gravityforms files are protected by a login session, that is it has no EPPN header.
  it('should return false if the request is for a gravityforms file and there is no logged in user', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/gravity_forms/somefile.json',
      headers: {
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(false);
  });
});
