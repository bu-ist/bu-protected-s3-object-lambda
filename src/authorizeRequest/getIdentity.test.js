import { describe, it, expect } from 'vitest';
import { getIdentity } from './getIdentity.js';

// Encodes attributes the way the edge builds its user-details header: the session token, with the
// IdP's attributes under auth-token.user, as base64 JSON. Every attribute is a list. Written as a
// helper so the fixtures show the attributes, rather than a base64 string a reader can't interpret.
function encodeUserDetails(attributes) {
  const token = { 'auth-token': { user: attributes } };

  return Buffer.from(JSON.stringify(token)).toString('base64');
}

const attributes = {
  eduPersonPrincipalName: ['test-user@bu.edu'],
  eduPersonPrimaryAffiliation: ['staff'],
  eduPersonEntitlement: ['https://iam.bu.edu/member/ist', 'https://iam.bu.edu/reg/college/com'],
};

const noIdentity = {
  eppn: '', userName: '', affiliation: '', entitlements: [],
};

describe('getIdentity', () => {
  describe('behind mod_shib', () => {
    it('should read the mod_shib attribute headers', () => {
      const headers = {
        Eppn: 'test-user@bu.edu',
        'Primary-Affiliation': 'staff',
        Entitlement: 'https://iam.bu.edu/member/ist;https://iam.bu.edu/reg/college/com',
      };
      expect(getIdentity(headers)).toEqual({
        eppn: 'test-user@bu.edu',
        userName: 'test-user',
        affiliation: 'staff',
        entitlements: 'https://iam.bu.edu/member/ist;https://iam.bu.edu/reg/college/com',
      });
    });

    // mod_shib sends Eppn on every request, an empty one indicates there is no login session.
    it('should report no login session when Eppn is empty', () => {
      const headers = { Eppn: '', 'Primary-Affiliation': '', Entitlement: '' };
      expect(getIdentity(headers).userName).toBe('');
    });
  });

  // Header names are in the form the SigV4 proxy delivers them (Authenticated, User-Details).
  describe('behind the edge', () => {
    it('should read the attributes from the user-details payload', () => {
      const headers = { Authenticated: 'true', 'User-Details': encodeUserDetails(attributes) };
      expect(getIdentity(headers)).toEqual({
        eppn: 'test-user@bu.edu',
        userName: 'test-user',
        affiliation: 'staff',
        entitlements: ['https://iam.bu.edu/member/ist', 'https://iam.bu.edu/reg/college/com'],
      });
    });

    it('should report no login session when the edge did not authenticate the request', () => {
      const headers = { Authenticated: 'false', 'User-Details': encodeUserDetails(attributes) };
      expect(getIdentity(headers)).toEqual(noIdentity);
    });

    it('should report no login session when the Authenticated header is missing', () => {
      const headers = { 'User-Details': encodeUserDetails(attributes) };
      expect(getIdentity(headers)).toEqual(noIdentity);
    });

    it('should report no login session when there are no identity headers at all', () => {
      expect(getIdentity({})).toEqual(noIdentity);
    });

    it('should report no login session when the payload cannot be parsed', () => {
      const headers = { Authenticated: 'true', 'User-Details': 'not a payload' };
      expect(getIdentity(headers)).toEqual(noIdentity);
    });
  });

  // Nothing in front of a mod_shib host removes the edge's header names, so on these requests they
  // could have been sent by the viewer, and the lambda can't tell. They must not be trusted.
  describe('edge headers on a mod_shib request', () => {
    it('should be ignored when there is no mod_shib login session', () => {
      const headers = {
        Eppn: '',
        Authenticated: 'true',
        'User-Details': encodeUserDetails({ eduPersonPrincipalName: ['edge-user@bu.edu'] }),
      };
      expect(getIdentity(headers).userName).toBe('');
    });

    it('should be ignored alongside a real mod_shib login', () => {
      const headers = {
        Eppn: 'real-user@bu.edu',
        Authenticated: 'true',
        'User-Details': encodeUserDetails({ eduPersonPrincipalName: ['edge-user@bu.edu'] }),
      };
      expect(getIdentity(headers).userName).toBe('real-user');
    });
  });
});
