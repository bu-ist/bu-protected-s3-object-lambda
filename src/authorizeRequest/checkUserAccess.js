function checkUserAccess(users, affiliations, entitlements, headers) {  
    // Destructure the header object to get the shib attributes, with defaults.
    const {
      'X-Bu-Shib-Username': userName = '',
      'X-Bu-Shib-Primary-Affiliation': userAffiliation = '',
      'X-Bu-Shib-Entitlement': userEntitlements = [],
    } = headers;

    // If the user is in the list of users, allow access
    const userAllowed = users.includes(userName);
  
    // If the user is in the list of affiliations, allow access
    const affiliationAllowed = affiliations.includes(userAffiliation);
  
    // Check entitlements.
    const entitlementsIntersection = entitlements.filter(x => userEntitlements.includes(x));
    const entitlementsAllowed = entitlementsIntersection.length > 0;
  
    // If the user is allowed by user list, status, or entitlement, allow return true to allow the request.
    return userAllowed || affiliationAllowed || entitlementsAllowed;
  }

  module.exports = { checkUserAccess };
