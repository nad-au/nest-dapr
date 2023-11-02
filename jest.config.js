module.exports = {
  verbose: false,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'tests',
  testEnvironment: 'node',
  testRegex: '.spec.ts$',
  bail: 1,
  testTimeout: 30000,
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tests/tsconfig.test.json',
        isolatedModules: true,
      },
    ],
  },
  preset: `ts-jest/presets/js-with-ts`,
};
