import { describe, it, expect } from 'vitest';
import { getIdentity } from './getIdentity.js';

describe('getIdentity', () => {
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

  it('should report no login session when there are no attribute headers', () => {
    expect(getIdentity({})).toEqual({
      eppn: '', userName: '', affiliation: '', entitlements: [],
    });
  });
});
