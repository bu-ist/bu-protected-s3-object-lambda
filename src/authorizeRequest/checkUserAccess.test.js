const { checkUserAccess } = require('./checkUserAccess');

// Setup an example rules object.
const exampleUserRules = {
  users: ['testuser', 'testuser2'],
  states: ['staff'],
  entitlements: ['https://iam.bu.edu/entitlements/some-entitlement', 'https://iam.bu.edu/entitlements/some-other-entitlement'],
};

describe('checkUserAccess', () => {
  it('should return false if there is no logged in user', () => {
    const headers = {
      eppn: '',
      'X-Bu-Shib-Primary-Affiliation': '',
      'X-Bu-Shib-Entitlement': [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(false);
  });

  it('should return false if the user attibutes dont match the rules', () => {
    const headers = {
      eppn: 'not-listed-user@bu.edu',
      'X-Bu-Shib-Primary-Affiliation': 'faculty',
      'X-Bu-Shib-Entitlement': ['not-an-entitlement', 'notentitlement2'],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(false);
  });

  it('should return true if the user is in the list of users', () => {
    const headers = {
      eppn: 'testuser@bu.edu',
      'primary-affiliation': '',
      entitlement: [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });

  it('should return true if the user is in the list of affiliations', () => {
    const headers = {
      eppn: 'someuser-not-in-the-list@bu.edu',
      'primary-affiliation': 'staff',
      entitlement: [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });

  it('should return true if the user has an entitlement', () => {
    const headers = {
      eppn: 'someuser-not-in-the-list@bu.edu',
      'primary-affiliation': 'student',
      entitlement: ['https://iam.bu.edu/entitlements/some-entitlement'],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });
});
