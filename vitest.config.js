/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    include: './src/**/*.test.js',
    exclude: ['.aws-sam/**/*'],
  },
});
