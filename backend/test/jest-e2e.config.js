// Real-Postgres HTTP e2e suite. Run with `npm run test:e2e -w backend` — needs a local Postgres
// reachable with the same credentials as backend/.env.example; it creates/drops its own
// `wavehubdb_test` database and never touches the dev `wavehubdb`.
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/global-setup.ts',
  setupFiles: ['<rootDir>/setup-env.ts'],
  testTimeout: 30000,
  maxWorkers: 1, // specs share one database
};
