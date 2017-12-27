// NOTE: This file was intentionally written in ES5/6
// (Why? ... Bc it's not transpiled before being used.)

/* eslint-disable import/no-extraneous-dependencies */
const { argv } = require('yargs')
const { get } = require('delver')
const dotenv = require('dotenv')
const fs = require('fs')
const PATH = require('path')
const pkg = require('./package.json')

const stageNameAsSetInPackageJSON = get(pkg, 'config.stage', 'int') // default: int
const { STAGE = stageNameAsSetInPackageJSON } = argv

const getDesiredStageFromPackageJSON = () => new Promise((resolve, reject) => {
  console.warn('') // newline
  console.warn('*'.repeat(22))
  console.warn(`***   STAGE: ${STAGE}   ***`)
  console.warn('*'.repeat(22))
  console.warn('') // newline
  return STAGE ? resolve(STAGE) : reject(new Error('STAGE Name is NOT set in "package.json"'))
})

const getAndSetVarsFromEnvFile = () => new Promise((resolve, reject) => {
  console.warn('') // newline
  console.info('Searching for ".env" file(s) containing variables to export...')
  fs.readFile(PATH.join(__dirname, '.env'), (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.info(' ... NONE FOUND!')
        console.info('Moving forward to next step.')
        // don't error if no '.env' file found
        resolve({ STAGE })
      }
      reject(error)
    }

    const envVars = dotenv.parse(data)
    const envVarKeys = typeof envVars === 'object' ? Object.keys(envVars) : {}
    const envVarCount = envVarKeys.length

    resolve({ ...envVars, STAGE })

    console.info(` ... Success!  FOUND ${envVarCount} variables; SET ${envVarCount} variables.`)
    console.info('Moving forward to next step.')
    console.warn('') // newline
  })
})

const getHostname = () => new Promise((resolve) => {
  const getSubdomain = () => {
    switch (`${STAGE}`.toLowerCase()) {
      case 'prod':
        return ''
      case 'int':
        return 'int-api'
      case 'dev':
      default:
        return 'dev-api'
    }
  }
  const fullHostname = `${getSubdomain()}.hixme.com`

  console.info(`Setting API Hostname to "${fullHostname}".`)
  console.info('') // newline
  resolve(fullHostname)
})

const getAPIBasePath = () => new Promise((resolve) => {
  const serviceName = get(pkg, 'name', 'untitled-project')
  const apiServiceName = serviceName.replace(/-service/, '').trim()

  console.info(`Setting API Base Path to "${apiServiceName}".`)
  console.info('') // newline
  resolve(apiServiceName)
})

module.exports = {
  getAndSetVarsFromEnvFile,
  getAPIBasePath,
  getDesiredStageFromPackageJSON,
  getHostname,
}
