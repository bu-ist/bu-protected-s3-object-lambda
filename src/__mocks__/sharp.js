exports.config = {};

exports.sharp = {

  // Mock the resize function to return a mock object with a toBuffer function.
  resize: jest.fn(() => ({
    withMetadata: jest.fn(() => ({
      toBuffer: jest.fn(() => 'test'),
    })),
  })),
};
