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
      'X-Bu-Shib-Username': '',
      'X-Bu-Shib-Primary-Affiliation': '',
      'X-Bu-Shib-Entitlement': [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(false);
  });

  it('should return false if the user attibutes dont match the rules', () => {
    const headers = {
      'X-Bu-Shib-Username': 'not-listed-user',
      'X-Bu-Shib-Primary-Affiliation': 'faculty',
      'X-Bu-Shib-Entitlement': ['not-an-entitlement', 'notentitlement2'],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(false);
  });

  it('should return true if the user is in the list of users', () => {
    const headers = {
      'X-Bu-Shib-Username': 'testuser',
      'X-Bu-Shib-Primary-Affiliation': '',
      'X-Bu-Shib-Entitlement': [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });

  it('should return true if the user is in the list of affiliations', () => {
    const headers = {
      'X-Bu-Shib-Username': 'someuser-not-in-the-list',
      'X-Bu-Shib-Primary-Affiliation': 'staff',
      'X-Bu-Shib-Entitlement': [],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });

  it('should return true if the user has an entitlement', () => {
    const headers = {
      'X-Bu-Shib-Username': 'someuser-not-in-the-list',
      'X-Bu-Shib-Primary-Affiliation': 'student',
      'X-Bu-Shib-Entitlement': ['https://iam.bu.edu/entitlements/some-entitlement'],
    };
    expect(checkUserAccess(exampleUserRules, headers)).toBe(true);
  });
});
