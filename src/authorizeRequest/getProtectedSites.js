import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

async function getProtectedSites() {
  // Load the protected sites from DynamoDB.

  // Instantiate a DynamoDB client.
  const dynamoDb = DynamoDBDocument.from(new DynamoDB({
    apiVersion: '2012-08-10',
    sslEnabled: false,
    paramValidation: false,
    convertResponseTypes: false,
  }));

  // Get the dynamodb table name from the environment.
  const tableName = process.env.DYNAMODB_TABLE;

  const { Item } = await dynamoDb.get({
    TableName: tableName,
    Key: { PK: 'PROTECTED_SITES' },
  });

  const { ProtectedSites } = Item;

  return JSON.parse(ProtectedSites);
}

export { getProtectedSites };
