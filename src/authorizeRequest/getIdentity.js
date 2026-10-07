// Resolves who is making the request from the headers mod_shib sets.
function getIdentity(headers) {
  const {
    Eppn: eppn = '',
    'Primary-Affiliation': affiliation = '',
    Entitlement: entitlements = [],
  } = headers;

  return {
    eppn,
    // The userName is the unscoped eppn ( e.g. the email without the @domain).
    userName: eppn.split('@')[0],
    affiliation,
    entitlements,
  };
}

export { getIdentity };
