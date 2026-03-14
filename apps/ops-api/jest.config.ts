import type { Config } from 'jest';
import path from 'path';

const config: Config = {
  rootDir: path.resolve(__dirname),
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: path.resolve(__dirname, '../../tsconfig.base.json'),
    }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@ops/db$': '<rootDir>/src/services/__tests__/__mocks__/ops-db.ts',
    '^@ops/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  verbose: true,
  testTimeout: 10000,
};

export default config;
