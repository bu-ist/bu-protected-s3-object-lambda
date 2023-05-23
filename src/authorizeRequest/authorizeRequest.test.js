const { authorizeRequest } = require('./authorizeRequest');

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
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(true);
  });

  it('should return false if the user is not logged in and the file is restricted to the entire bu community', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/entire-bu-community/image.jpg',
      headers: {
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest);
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
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(true);
  });

  // Affiliation tests.

  // Entitlement tests.

  // Add a test for a root site vs a sub site.
  it('should return true if the user is granted access by user name', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/files/__restricted/somegroup/image.jpg',
      headers: {
        Eppn: 'user2@bu.edu',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(true);
  });

  // Network tests.
  it('should return true if the user is granted access by network address', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/somegroup/image.jpg',
      headers: {
        'X-Real-Ip': '128.197.30.30',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest);
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
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(false);
  });

  it('should return false if the user only has network address access, and satisfy_all is true', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/__restricted/othergroup/image.jpg',
      headers: {
        'X-Real-Ip': '128.197.30.30',
        'X-Forwarded-Host': 'example.host.bu.edu, example.host.bu.edu',
      },
    };
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(false);
  });
});
