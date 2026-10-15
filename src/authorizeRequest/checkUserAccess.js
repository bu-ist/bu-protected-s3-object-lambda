function checkUserAccess(rules, identity) {
  // The identity is resolved from the request headers by getIdentity.
  const {
    userName,
    affiliation: userAffiliation,
    entitlements: userEntitlements,
  } = identity;

  // If the userName is empty, restrict access immediately.
  if (userName.trim() === '') {
    return false;
  }

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
