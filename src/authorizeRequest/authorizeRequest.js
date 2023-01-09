const { DynamoDB } = require('aws-sdk');

const { checkUserAccess } = require('./checkUserAccess');

async function authorizeRequest(userRequest) {
    // Check if the user is authorized to access the object.
    const { url, headers } = userRequest;

    if  (!url.includes('__restricted')) {
        // Unrestricted items are always allowed.
        // Will need to account for whole site protections here.
        return true;
    }

    // Instantiate a DynamoDB client.
    const dynamoDb = new DynamoDB.DocumentClient({
        apiVersion: '2012-08-10',
        sslEnabled: false,
        paramValidation: false,
        convertResponseTypes: false
    });

    // Get the group name from the uri, it is the segment after the "/__restricted/" segment.
    // Should probably sanitize the path segments here, to only valid url characters just in case.
    const pathSegments = url.split('/');
    const groupName = pathSegments[pathSegments.indexOf('__restricted') + 1];

    // Special handling for the entire-bu-community group, which only requires a valid BU login.
    if (groupName === 'entire-bu-community') {
        // This should be more elegant, but it checks for a non-empty shibboleth username header.
        const hasShibUsername = ('X-Bu-Shib-Username' in headers) && headers['X-Bu-Shib-Username'] !== '';

        return hasShibUsername;
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
    const { users = [], states: affiliations = [], entitlements = [] } = JSON.parse(Item.rules);

    // Apply the user rules.
    const allowed = checkUserAccess(users, affiliations, entitlements, headers);

    return allowed;
}

module.exports = { authorizeRequest };