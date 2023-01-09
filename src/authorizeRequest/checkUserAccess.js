function checkUserAccess(users, affiliations, entitlements, headers) {
    // Get the username from the headers.
    let userName = '';
    if ('X-Bu-Shib-Username' in headers) {
      userName = headers['X-Bu-Shib-Username'];
    }
  
    let userAffiliation = '';
    if ('X-Bu-Shib-Primary-Affiliation' in headers) {
      userAffiliation = headers['X-Bu-Shib-Primary-Affiliation'];
    }
  
    let userEntitlements = [];
    if ('X-Bu-Shib-Entitlement' in headers) {
      userEntitlements = headers['X-Bu-Shib-Entitlement'].split(';');
    }
  
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
