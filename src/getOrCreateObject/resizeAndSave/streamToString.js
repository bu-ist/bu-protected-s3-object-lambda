// This is necessary to transform the stream from S3 into a buffer that can be used by sharp.
// More info here: https://kieron-mckenna.medium.com/s3-image-optimization-and-compression-with-the-cdk-a-typescript-lambda-and-sharp-894b272d2d8e
// And here: https://github.com/aws/aws-sdk-js-v3/issues/1877#issuecomment-1071508390
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = { streamToString };
