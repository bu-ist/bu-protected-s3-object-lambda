/* eslint-disable func-names */
/* eslint-disable object-shorthand */

// Set up some example records for the DynamoDB mock.
const exampleRecords = {
  somegroup: {
    Item: {
      rules: JSON.stringify({
        users: ['user1', 'user2', 'test', 'test2'],
        states: ['faculty', 'staff'],
        entitlements: ['https://iam.bu.edu/reg/college/com'],
        ranges: ['crc'],
        satisfy_all: false,
      }),
    },
  },
  othergroup: {
    Item: {
      rules: JSON.stringify({
        users: ['user1', 'user2', 'test', 'test2'],
        ranges: ['crc'],
        satisfy_all: true,
      }),
    },
  },
};

const exampleSizes = {
  Item: {
    sizes: JSON.stringify({ thumbnail: { width: 150, height: 150, crop: ['top'] } }),
  },
};

exports.config = {};

exports.DynamoDB = {
  DocumentClient: function () {
    return {
      get: jest.fn((params) => {
        // Return a mock promise that resolves to an example record.
        const { Key: { SiteAndGroupKey } } = params;

        // Extract the group name from the SiteAndGroupKey, which uses a '#' as a delimiter.
        const [compKey, compValue] = SiteAndGroupKey.split('#');

        // Return a size object for the SIZES# group key, and a ruleset for anything else.
        const response = compKey.startsWith('SIZES') ? exampleSizes : exampleRecords[compValue];

        return {
          promise: async () => response,
        };
      }),
    };
  },
};

exports.S3 = jest.fn(() => ({
  getObject: jest.fn((params) => {
    console.log('params', params);
    return {
      promise: async () => ({ Body: 'test' }),
    };
  }),
}));
