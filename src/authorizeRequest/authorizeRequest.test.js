const { authorizeRequest } = require('./authorizeRequest');

describe('authorizeRequest', () => {
  // Entire community group tests.
  it('should return true if the user is granted access through the entire community group', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/__restricted/entire-bu-community/image.jpg',
      headers: {
        'X-Bu-Shib-Username': 'testUser',
      },
    };
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(true);
  });

  it('should return false if the user is not logged in and the file is restricted to the entire bu community', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/__restricted/entire-bu-community/image.jpg',
      headers: {},
    };
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(false);
  });

  // Group tests.
  it('should return true if the user is granted access by user name', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/__restricted/somegroup/image.jpg',
      headers: {
        'X-Bu-Shib-Username': 'user2',
      },
    };
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(true);
  });

  // Network tests.
  it('should return true if the user is granted access by network address', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/__restricted/somegroup/image.jpg',
      headers: {
        'X-Bu-Ip-Forwarded-For': '128.197.30.30',
      },
    };
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(true);
  });

  it('should return false if the user is not granted access by network address', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/__restricted/somegroup/image.jpg',
      headers: { 'X-Bu-Ip-Forwarded-For': '127.0.0.1' },
    };
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(false);
  });

  it('should return false if the user only has network address access, and satisfy_all is true', async () => {
    const userRequest = {
      url: 'https://example-access-point.s3-object-lambda.us-east-1.amazonaws.com/somesite/__restricted/othergroup/image.jpg',
      headers: { 'X-Bu-Ip-Forwarded-For': '128.197.30.30' },
    };
    const result = await authorizeRequest(userRequest);
    expect(result).toBe(false);
  });
});
