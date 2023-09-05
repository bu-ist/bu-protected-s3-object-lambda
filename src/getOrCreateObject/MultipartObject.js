const { S3 } = require('@aws-sdk/client-s3');

const bucketName = process.env.ORIGINAL_BUCKET;

const s3 = new S3();

/**
 * Get the object range.
 * Parameters: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/getobjectcommand.html
 * @param {*} userRequest 
 * @param {*} s3Key 
 * @returns 
 */
async function tryGetObjectRange(userRequest, s3Key) {
  // If Range or partNumber were query string parameters, they need to be removed now.
  // Also, video would have no other querystring parms since things like resizing, cropping, etc. do not apply.
  const s3_key = s3Key.split('?')[0];
  let response;
  const parms = {
    Bucket: bucketName,
    Key: s3Key
  };
  if(getRange(userRequest)) {
    parms.Range = getRange(userRequest);
  }
  if(getPartNumber(userRequest)) {
    parms.PartNumber = getPartNumber(userRequest);
  }
  console.log('[parms]:\n', JSON.stringify(parms, null, 2));
  try {
    response = await s3.getObject(parms)
  } catch (error) {
    console.log('[error]:\n', JSON.stringify(error, null, 2));
    return error;
  }
  console.log('[response]:\n', JSON.stringify(response, (key, value) => {
    if(key.toLowerCase() === 'body') {
      return null
    }
    return value;
  }, 2));
  return response;
}

function getRange(userRequest) {
  if(userRequest.headers.Range) {
    return userRequest.headers.Range;
  }
  const { searchParams } = new URL(userRequest.url);
  return searchParams.get('Range');
}

function getPartNumber(userRequest) {
  const { searchParams } = new URL(userRequest.url);
  return searchParams.get('partNumber');
}

function isRangeRequest(userRequest) {
  return getRange(userRequest) || getPartNumber(userRequest);
}

module.exports = { isRangeRequest, tryGetObjectRange };
