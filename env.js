// NOTE: This file was intentionally written in ES5

// eslint-disable-next-line import/no-extraneous-dependencies
const { argv } = require('yargs');
const packageStage = require('./package.json').config.stage;

let { stage } = argv;

if (!stage) {
  stage = packageStage;
}

// eslint-disable-next-line import/no-extraneous-dependencies
const dotenv = require('dotenv');
const fs = require('fs');
const PATH = require('path');

module.exports.packageStageName = () => new Promise((resolve, reject) => {
  console.warn(`Stage Name: ${stage}`);
  return stage ? resolve(stage) : reject(new Error('stage name isn\'t set in package.json'));
});

module.exports.default = () => new Promise((resolve, reject) => {
  fs.readFile(PATH.join(__dirname, '.env'), (err, data) => {
    if (err) return reject(err);
    const envVars = dotenv.parse(data);
    return resolve(Object.assign({}, envVars, {
      STAGE: stage,
    }));
  });
});

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
  const existingServiceName = require('./package.json').name;
  const apiServiceName = existingServiceName.replace(/-service/, '').trim();

  if (!apiServiceName || apiServiceName == null) {
    return reject();
  }

  return resolve(apiServiceName);
});
