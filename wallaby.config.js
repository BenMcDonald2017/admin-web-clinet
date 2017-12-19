module.exports = () => ({
  files: ['./src/**/*.js', '!src/**/__tests__/*.js'],
  tests: ['./__tests__/**/*.js'],
  env: {
    type: 'node',
    runner: 'node',
  },
  testFramework: 'jest',
})
