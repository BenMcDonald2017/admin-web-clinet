#!/usr/bin/env node

// NOTE: This file is intentionally written in ES5/6, as it's NOT transpiled
/* eslint-disable import/no-extraneous-dependencies, no-console */

const { argv } = require('yargs')
const {
  drawInitialNewline, horizontalRule, centerText, getSubdomainPrefix, /* newline, */
} = require('./build/utils')

const { get } = require('delver')
const { green, reset } = require('chalk')
const dotenv = require('dotenv')
const dotenvExpand = require('dotenv-expand')
const pkg = require('./package.json')

// if this microservice is initiated with an argument named, "STAGE", then that
// value will overwrite the "STAGE" of the app. If no args, it defaults to "int",
// since that's the value in "package.json:config.stage". If that's not found,
// then I default "STAGE" to "int":
const { STAGE = get(pkg, 'config.stage', 'int') } = argv
const myEnv = dotenv.config()

function success(description = '', information = '') {
  drawInitialNewline()
  centerText(`${description}: ${information}${reset('.')}`)
  horizontalRule()
  return true
}

function pluralize(count = 0) {
  if (count > 1 || count === 0) return 's'
  return ''
}

module.exports.getAndSetVarsFromEnvFile = () => new Promise((resolve) => {
  const taskDescription = 'Locating ".env" Config File'
  const { parsed: environmentVariables = {} } = dotenvExpand(myEnv)
  const envVariableCount = Object.keys(environmentVariables).length
  // in this case, if we don't have any env variables, we don't want to reject;
  // instead, we want to resolve with a single environment variable: "STAGE"
  const taskSuccessInfo = `Exported ${green(envVariableCount)} Variable${pluralize(envVariableCount)}`
  success(taskDescription, taskSuccessInfo)
  resolve({ ...environmentVariables, STAGE })
})

module.exports.getDesiredStageFromPackageJSON = () => new Promise((resolve, reject) => {
  const taskDescription = 'Setting API / Service Stage'
  // check for "STAGE" having been set; rejects if not
  if (typeof STAGE === 'undefined' || STAGE == null) reject(new (Error(taskDescription))())
  // print success message(s) and resolve value to caller
  const taskSuccessInfo = `${green(STAGE)}`
  success(taskDescription, taskSuccessInfo)
  resolve(STAGE)
})

module.exports.getAPIBasePath = () => new Promise((resolve) => {
  const taskDescription = 'Setting API Path'
  const serviceNameFromPackageJSONFile = get(pkg, 'name', 'untitled-project')
  // removes the "service" text at the end, if any!
  const apiBasePath = serviceNameFromPackageJSONFile.replace(/-service/igm, '').trim()
  const taskSuccessInfo = `Path: "${green(`/${apiBasePath}`)}"`
  success(taskDescription, taskSuccessInfo)
  resolve(apiBasePath)
})

module.exports.getHostname = () => new Promise((resolve) => {
  const taskDescription = 'Setting API Hostname'
  const hostname = `${getSubdomainPrefix('api')}.hixme.com`
  // the function "getSubdomainPrefix()" will ALWAYS return a value;
  // as such, we only ever need to resolve
  const taskSuccessInfo = `${green(hostname)}`
  success(taskDescription, taskSuccessInfo)
  resolve(hostname)
})
