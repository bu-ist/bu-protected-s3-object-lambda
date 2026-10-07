import { describe, it, expect } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

// eslint-disable-next-line import/first
import { authorizeRequest } from './authorizeRequest.js';

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
  // mod_shib sends Eppn on every request, an empty one indicates there is no login session.

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
        Eppn: '',
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

  it('should return false if a logged in user matches no rule from off campus', async () => {
    // The address is set off campus so the group's network rule cannot grant access instead.
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        Eppn: 'someone@bu.edu',
        'X-Real-Ip': '11.0.0.1',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(false);
  });

  // BU's IdP may scope an eppn to bu.edu or alum.bu.edu. Everything after the @ is removed, so an
  // alum.bu.edu principal matches the bare user name. bu-access-control strips only @bu.edu.
  it('should return true for a listed user name scoped to alum.bu.edu', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        Eppn: 'user2@alum.bu.edu',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(true);
  });

  // Affiliation tests.
  it('should return true if the user is granted access by primary affiliation', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        Eppn: 'someone@bu.edu',
        'Primary-Affiliation': 'staff',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(true);
  });

  // Entitlement tests.
  it('should return true if the user is granted access by entitlement', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        Eppn: 'someone@bu.edu',
        // mod_shib joins multiple values with semicolons.
        Entitlement: 'https://iam.bu.edu/member/ist;https://iam.bu.edu/reg/college/com',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(true);
  });

  // Known flaw, kept as current behavior until it is fixed on its own: the header is compared as
  // a string, so .../college/community matches a grant of .../college/com.
  it('currently returns true for an entitlement that only contains a granted one', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        Eppn: 'someone@bu.edu',
        Entitlement: 'https://iam.bu.edu/reg/college/community',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(true);
  });

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
        Eppn: '',
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
        Eppn: '',
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
        Eppn: '',
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
        Eppn: '',
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

  // Check that gravityforms files are protected by a login session,
  // and should return false if there is no logged in user (i.e., Eppn is empty).
  it('should return false if the request is for a gravityforms file and there is no logged in user', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/gravity_forms/somefile.json',
      headers: {
        Eppn: '',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(false);
  });

  it('should return true if the request is for a gravityforms file and there is a logged in user', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/gravity_forms/somefile.json',
      headers: {
        Eppn: 'testuser@bu.edu',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest, null, testRanges);
    expect(result).toBe(true);
  });
});
