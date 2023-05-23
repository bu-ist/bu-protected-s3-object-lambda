// Tests for getOrCreateObject
// will need to mock the S3 object

const { getOrCreateObject } = require('./getOrCreateObject');

describe('getOrCreateObject', () => {
  it('should return an object', async () => {
    const result = await getOrCreateObject(
      'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/somesite/files/01/example-150x150.jpg',
      'www.bu.edu',
    );
    expect(result.Body).toBeDefined();
  });

  it('should return an an object, and parse the crop value', async () => {
    const result = await getOrCreateObject(
      'https://example-1111.s3-object-lambda.us-east-1.amazonaws.com/files/01/example-758x460.jpg?resize-position=left',
      'www.bu.edu',
    );
    expect(result.Body).toBeDefined();
  });
});
