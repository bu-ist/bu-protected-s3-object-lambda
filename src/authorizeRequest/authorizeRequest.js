const { DynamoDB } = require('aws-sdk');

const { checkUserAccess } = require('./checkUserAccess');

async function authorizeRequest(userRequest) {
    // Check if the user is authorized to access the object.
    const { url, headers } = userRequest;

    // Instantiate a DynamoDB client.
    const dynamoDb = new DynamoDB.DocumentClient({
        apiVersion: '2012-08-10',
        sslEnabled: false,
        paramValidation: false,
        convertResponseTypes: false
    });

    const { 'X-Bu-Shib-Username': userName = '' } = headers;

    // Get the group name from the uri, it is the segment after the "/__restricted/" segment.
    // Should probably sanitize the path segments here, to only valid url characters just in case.
    const pathSegments = url.split('/');
    const groupName = pathSegments[pathSegments.indexOf('__restricted') + 1];

    // Special handling for the entire-bu-community group, which only requires a valid BU login.
    if (groupName === 'entire-bu-community' && userName !== '') {
        // If there is a valid BU login, allow access.
        return true;
    }
    
    // Get the dynamodb table name from the environment.
    const tableName = process.env.DYNAMODB_TABLE;
    
    // Get the rules for the group.
    const { Item } = await dynamoDb.get({
        TableName: tableName,
        Key: { SiteAndGroupKey: groupName }
    }).promise();

    if (Item == null) {
        // If the group rules are not found, log the error then deny access.
        console.log('Failed to find the group in DynamoDB for group: ', groupName);
        return false;
    }
    
    // Parse the rules.
    const rules = JSON.parse(Item.rules);

    // Apply the user rules.
    const allowed = checkUserAccess(rules, headers);

    return allowed;
}

module.exports = { authorizeRequest };