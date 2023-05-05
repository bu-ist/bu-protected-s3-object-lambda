const { DynamoDB } = require('aws-sdk');

async function lookupCustomCrop(url, domain, sizeMatch) {
  // Instantiate a DynamoDB client.
  const dynamoDb = new DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    sslEnabled: false,
    paramValidation: false,
    convertResponseTypes: false,
  });

  // Get the dynamodb table name from the environment.
  const tableName = process.env.DYNAMODB_TABLE;

  const pathSegments = url.split('/');
  const indexOfFiles = pathSegments.indexOf('files');

  // Get the site name from the url, it is the segment before the "/files/" segment, unless it is a root site.
  const siteName = indexOfFiles === 3 ? '' : `/${pathSegments[indexOfFiles - 1]}`;

  // Construct the params object for the get call.
  const params = {
    TableName: tableName,
    Key: {
      SiteAndGroupKey: `SIZES#${domain}${siteName}`,
    },
  };

  const { Item = null } = await dynamoDb.get(params).promise();

  if (!Item) {
    return null;
  }

  const sizes = Object.values(JSON.parse(Item.sizes));
  const matchingSize = findMatchingSize(sizes, sizeMatch);

  return matchingSize;
}

function findMatchingSize(sizes, sizeMatch) {
  if (!sizeMatch) {
    return null;
  }

  const matchingSize = sizes.find((size) => {
    const { width, height } = size;

    const match = parseInt(sizeMatch[1], 10) === parseInt(width, 10)
      && parseInt(sizeMatch[2], 10) === parseInt(height, 10);

    return match;
  });
  return matchingSize;
}

module.exports = { lookupCustomCrop };
