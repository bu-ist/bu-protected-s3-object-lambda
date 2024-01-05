import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

import { checkUserAccess } from './checkUserAccess';
import { checkNetworkAccess } from './checkNetworkAccess/checkNetworkAccess';

async function authorizeRequest(userRequest, siteRule) {
  // Check if the user is authorized to access the object.
  const { url, headers } = userRequest;

  // Instantiate a DynamoDB client.
  const dynamoDb = DynamoDBDocument.from(new DynamoDB({
    apiVersion: '2012-08-10',
    sslEnabled: false,
    paramValidation: false,
    convertResponseTypes: false,
  }));

  const {
    Eppn: eppn = '',
    'X-Forwarded-Host': forwardedHost = '',
  } = headers;

  // Get the userName as the unscoped eppn ( e.g. the email without the @domain).
  const userName = eppn.split('@')[0];

  // Get the domain from the forwarded host, is this going to be reliable?
  const domain = forwardedHost.split(', ')[0];

  // Get the group name from the uri, it is the segment after the "/__restricted/" segment.
  // Should probably sanitize the path segments here, to only valid url characters just in case.
  const pathSegments = url.split('/');

  const indexOfRestricted = pathSegments.indexOf('__restricted');
  // If there is no __restricted segment, set the group name to null.
  let groupName = indexOfRestricted !== -1 ? pathSegments[indexOfRestricted + 1] : null;
  let isRootSite = indexOfRestricted ? indexOfRestricted < 5 : false;

  // If there is a whole-site protection rule, the group name will be the value of the rule.
  // Unless there is a group name in the url, individual protections take precedence.
  if (siteRule && !groupName) {
    groupName = Object.values(siteRule)[0];
    // If there's nothing after the domain, then this is a root site.
    isRootSite = Object.keys(siteRule)[0] === domain;
  }

  // Detect if this is the root site by the position of the __restricted segment.
  // Not sure if this should be detected by position of '__restricted' or by proximity to 'files'.
  let siteName = isRootSite ? '' : pathSegments[indexOfRestricted - 2];

  if (siteRule) {
    siteName = isRootSite ? '' : Object.keys(siteRule)[0].split('/')[1];
  }

  // This still has problems with the root site, since there is no site name it will leave a useless trailing slash.
  const siteAndGroupKey = `${domain}/${siteName}#${groupName}`;

  // Special handling for the entire-bu-community group, which only requires a valid BU login.
  if (groupName === 'entire-bu-community') {
    // If there is a valid BU login, allow access, otherwise deny immediately.
    return (userName !== '');
  }

  // Get the dynamodb table name from the environment.
  const tableName = process.env.DYNAMODB_TABLE;

  // Get the rules for the group.
  // Need to skip this for the entire-bu-community group, since it is not in the database.
  // to avoid INFO Failed to find the group in DynamoDB for group:  entire-bu-community
  const { Item } = await dynamoDb.get({
    TableName: tableName,
    Key: { PK: siteAndGroupKey },
  });

  if (Item == null) {
    // If the group rules are not found, log the error then deny access.
    console.log('Failed to find the group in DynamoDB for group: ', groupName);
    return false;
  }

  // Parse the rules.
  const rules = JSON.parse(Item.rules);

  // Apply the rules.
  const userAllowed = checkUserAccess(rules, headers);
  const networkAllowed = checkNetworkAccess(rules, headers);

  // Check for a satisfy all flag in the rules, default to false.
  const { satisfy_all: satisfyAll = false } = rules;

  // If the rules are set to satisfy all, then both the user and network must be allowed.
  // Otherwise, either the user or network must be allowed.
  const allowed = satisfyAll ? userAllowed && networkAllowed : userAllowed || networkAllowed;

  return allowed;
}

export { authorizeRequest };
