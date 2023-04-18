function checkUserAccess(rules, headers) {
  // Destructure the header object to get the shib attributes, with defaults.
  const {
    eppn = '',
    'primary-affiliation': userAffiliation = '',
    entitlement: userEntitlements = [],
  } = headers;

  // Get the userName as the unscoped eppn ( e.g. the email without the @domain).
  const userName = eppn.split('@')[0];

  // Unpack the rules, with defaults.
  const { users = [], states: affiliations = [], entitlements = [] } = rules;

  // If the user is in the list of users, allow access
  const userAllowed = users.includes(userName);

  // If the user is in the list of affiliations, allow access
  const affiliationAllowed = affiliations.includes(userAffiliation);

  // Check entitlements.
  const entitlementsIntersection = entitlements.filter((x) => userEntitlements.includes(x));
  const entitlementsAllowed = entitlementsIntersection.length > 0;

  // If the user is allowed by user list, status, or entitlement, return true to allow the request.
  return userAllowed || affiliationAllowed || entitlementsAllowed;
}

module.exports = { checkUserAccess };
