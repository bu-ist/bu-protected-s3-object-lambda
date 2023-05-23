const { lookupCustomCrop } = require('./lookupCustomCrop');

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
