function checkUserAccess(rules, headers) {
  // Destructure the header object to get the shib attributes, with defaults.
  const {
    Eppn: eppn = '',
    'Primary-Affiliation': userAffiliation = '',
    Entitlement: userEntitlements = [],
  } = headers;

  // Get the userName as the unscoped eppn ( e.g. the email without the @domain).
  const userName = eppn.split('@')[0];

  // Unpack the rules, with defaults.
  const {
    users = [], states: affiliations = [], entitlements = [], admins = [],
  } = rules;

  // Merge the users and admins arrays.
  const allowedUsers = [...users, ...admins];

  // If the user is in the list of users, allow access
  const userAllowed = allowedUsers.includes(userName);

  // If the user is in the list of affiliations, allow access
  const affiliationAllowed = affiliations.includes(userAffiliation);

  // Check entitlements.
  const entitlementsIntersection = entitlements.filter((x) => userEntitlements.includes(x));
  const entitlementsAllowed = entitlementsIntersection.length > 0;

  // If the user is allowed by user list, status, or entitlement, return true to allow the request.
  return userAllowed || affiliationAllowed || entitlementsAllowed;
}

export { checkUserAccess };
