// NOTE: This file was intentionally written in ES5/6
// (Why? ... Bc it's not transpiled before being used.)

/* eslint-disable import/no-extraneous-dependencies */
const { argv } = require('yargs')
const dotenv = require('dotenv')
const fs = require('fs')
const PATH = require('path')
const pkg = require('./package.json')

const stageNameAsSetInPackageJSON = (pkg && pkg.config && pkg.config.stage) || 'int'

let { stage = stageNameAsSetInPackageJSON } = argv

const getDesiredStageFromPackageJSON = () => new Promise((resolve, reject) => {
  console.warn('')
  console.warn('*'.repeat(22))
  console.warn(`***   Stage: ${stage}   ***`)
  console.warn('*'.repeat(22))
  console.warn('')
  return stage ? resolve(stage) : reject(new Error('stage name isn\'t set in package.json'))
})

const getAndSetVarsFromEnvFile = () => new Promise((resolve, reject) => {
  fs.readFile(PATH.join(__dirname, '.env'), (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // don't error if no '.env' file found
        return resolve(Object.assign({}, {
          STAGE: stage,
        }))
      }
      return reject(error)
    }
    const envVars = dotenv.parse(data)
    return resolve(Object.assign({}, envVars, {
      STAGE: stage,
    }))
  })
})

const getDomainName = () => new Promise((resolve, reject) => {
  stage = `${stage}`.toLowerCase()

  if (!stage || stage == null || stage === 'dev') {
    return resolve('dev-api.hixme.com')
  }

  if (stage === 'int') {
    return resolve('int-api.hixme.com')
  }

  if (stage === 'prod') {
    return resolve('api.hixme.com')
  }

  return reject()
})

const getAPIBasePath = () => new Promise((resolve, reject) => {
  const existingServiceName = require('./package.json').name
  const apiServiceName = existingServiceName.replace(/-service/, '').trim()

  if (!apiServiceName || apiServiceName == null) {
    return reject()
  }

  return resolve(apiServiceName)
})

module.exports = {
  getAndSetVarsFromEnvFile,
  getAPIBasePath,
  getDesiredStageFromPackageJSON,
  getDomainName,
}
