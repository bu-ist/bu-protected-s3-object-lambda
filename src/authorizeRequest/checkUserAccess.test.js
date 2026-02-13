import { describe, it, expect } from 'vitest';
import { checkUserAccess } from './checkUserAccess.js';

// Setup an example rules object.
const exampleUserRules = {
  users: ['testuser', 'testuser2'],
  states: ['staff'],
  entitlements: ['https://iam.bu.edu/entitlements/some-entitlement', 'https://iam.bu.edu/entitlements/some-other-entitlement'],
  admins: ['test-admin'],
};

describe('checkUserAccess', () => {
  it('should return false if there is no logged in user', () => {
    const headers = {
      Eppn: '',
      'Primary-Affiliation': '',
      Entitlement: [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(false);
  });

  it('should return false if the user attibutes dont match the rules', () => {
    const headers = {
      Eppn: 'not-listed-user@bu.edu',
      'Primary-Affiliation': 'faculty',
      Entitlement: ['not-an-entitlement', 'notentitlement2'],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(false);
  });

  it('should return true if the user is in the list of users', () => {
    const headers = {
      Eppn: 'testuser@bu.edu',
      'Primary-Affiliation': '',
      Entitlement: [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });

  it('should return true if the user is in the list of affiliations', () => {
    const headers = {
      Eppn: 'someuser-not-in-the-list@bu.edu',
      'Primary-Affiliation': 'staff',
      Entitlement: [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });

  it('should return true if the user has an entitlement', () => {
    const headers = {
      Eppn: 'someuser-not-in-the-list@bu.edu',
      'Primary-Affiliation': 'student',
      Entitlement: ['https://iam.bu.edu/entitlements/some-entitlement'],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });

  it('should return true if the user is an admin', () => {
    const headers = {
      Eppn: 'test-admin@bu.edu',
      'Primary-Affiliation': 'faculty',
      Entitlement: [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });
});

it('should return false if the userName is only whitespace', () => {
  const headers = {
    Eppn: '   @bu.edu',
    'Primary-Affiliation': 'staff',
    Entitlement: ['https://iam.bu.edu/entitlements/some-entitlement'],
  };
  expect(checkUserAccess(exampleUserRules, headers)).toBe(false);
});

it('should return false if eppn is just the domain', () => {
  const headers = {
    Eppn: '@bu.edu',
    'Primary-Affiliation': 'staff',
    Entitlement: ['https://iam.bu.edu/entitlements/some-entitlement'],
  };
  expect(checkUserAccess(exampleUserRules, headers)).toBe(false);
});
