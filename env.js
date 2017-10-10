// eslint-disable-next-line import/no-extraneous-dependencies
const { argv } = require('yargs');

let { stage = 'dev' } = argv;

module.exports.getDomainName = () => new Promise((resolve, reject) => {
  stage = `${stage}`.toLowerCase();

  if (!stage || stage == null || stage === 'dev') {
    return resolve('dev-api.hixme.com');
  }

  if (stage === 'int') {
    return resolve('int-api.hixme.com');
  }

  if (stage === 'prod') {
    return resolve('api.hixme.com');
  }

  return reject();
});

module.exports.getAPIBasePath = () => new Promise((resolve, reject) => {
  // eslint-disable-next-line global-require
  const existingServiceName = require('./package.json').name;
  const apiServiceName = existingServiceName.replace(/-service/, '').trim();

  if (!apiServiceName || apiServiceName == null) {
    return reject();
  }

  return resolve(apiServiceName);
});
