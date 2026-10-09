// This is a helper function to determine if the request is behind mod_shib.
// mod_shib sets Eppn on every request (empty when there is no login session) and rejects a request
// that tries to supply its own. The container's Apache unsets it. So the header's presence, not
// its value, signals that mod_shib is in front of this request.
function isBehindModShib(headers) {
  return Object.hasOwn(headers, 'Eppn');
}

// Formats the mod_shib headers into the same shape that readEdgeIdentity returns.
function readModShibIdentity(headers) {
  // Entitlement is the semicolon-joined string mod_shib sends. It should be split into separate
  // values: compared as one string, it over-matches. This is preserved as-is for now.
  const {
    Eppn: eppn = '',
    'Primary-Affiliation': affiliation = '',
    Entitlement: entitlements = [],
  } = headers;

  return { eppn, affiliation, entitlements };
}

// The edge's user-details header contains the session details in base64-encoded JSON format.
// This function decodes it to extract the user's attributes. It returns an empty object
// if the header is missing or can't be parsed.
function decodeUserDetails(encoded = '') {
  try {
    // The token wraps the session attributes under 'auth-token',
    // which is defined as shibboleth-sp's JwtTools.TOKEN_NAME.
    return JSON.parse(Buffer.from(encoded, 'base64').toString())?.['auth-token']?.user ?? {};
  } catch {
    return {};
  }
}

// Reads the identity the edge SP sends. The payload is read only when the edge says it
// authenticated the request.
// Header names arrive in Go's canonical form (Authenticated, User-Details), because the SigV4
// proxy in front of the Object Lambda rewrites them.
function readEdgeIdentity(headers) {
  const attributes = headers.Authenticated === 'true'
    ? decodeUserDetails(headers['User-Details'])
    : {};

  // Return the attributes in a consistent format. All attributes are arrays,
  // so extract the first element for single values. Also provide a default empty
  // value for any missing attribute.
  return {
    eppn: attributes.eduPersonPrincipalName?.[0] ?? '',
    affiliation: attributes.eduPersonPrimaryAffiliation?.[0] ?? '',
    entitlements: attributes.eduPersonEntitlement ?? [],
  };
}

// Parses the identity information from the headers and returns a consistent identity object.
// It selects the appropriate method based on whether the request is behind mod_shib or the edge.
// Each upstream only clears its own headers, so selecting correctly is crucial for security.
function getIdentity(headers) {
  const { eppn, affiliation, entitlements } = isBehindModShib(headers)
    ? readModShibIdentity(headers)
    : readEdgeIdentity(headers);

  return {
    eppn,
    // Authorization rules use the unscoped part of the eppn (e.g. the email without the @domain).
    userName: eppn.split('@')[0],
    affiliation,
    entitlements,
  };
}

export { getIdentity };
