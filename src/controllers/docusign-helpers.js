import { capitalize, camelCase } from 'lodash'

export const DOCUSIGN_ROLE_NAMES = [
  'worker', 'spouse', 'dep1', 'dep2', 'dep3', 'dep4', 'dep5', 'dep6',
]

const isBoolean = value => typeof value === typeof true
const isNumber = value => !!(value === 0 || (!Number.isNaN(value) && Number(value)))
const isSomething = value => isBoolean(value) || isNumber(value) || (value && value != null)
const revertToType = content => ((isBoolean(content) || isNumber(content)) ? content : `${content}`)
const tabName = (name = 'text') => camelCase(`${name}Tabs`)
export const format = content => (isSomething(content) ? revertToType(content) : ' ')

function getRoleName(role = 0, returnCapitalizedRoleName = true) {
  function cap(content) {
    return returnCapitalizedRoleName ? capitalize(content) : content
  }

  switch (typeof role) {
    case 'number':
      return cap(DOCUSIGN_ROLE_NAMES[role])
    case 'string':
      return cap(DOCUSIGN_ROLE_NAMES.find(r => new RegExp(role, 'i').test(r)))
    default:
      return cap(DOCUSIGN_ROLE_NAMES[0])
  }
}

export function generateComposedTemplates(templateIDs = [], optionalFormattedSignersArray = []) {
  const composedTemplates = []
  const recipients = { signers: optionalFormattedSignersArray }
  templateIDs.map((id, index) => {
    const sequence = `${index + 1}`
    return composedTemplates.push({
      serverTemplates: [{ sequence, templateId: id }],
      inlineTemplates: [{ sequence, recipients }],
    })
  })
  return composedTemplates
}

export const generateSigners = (signers = [], fields = {}) => signers.map((signer, index) => ({
  /* eslint-disable no-nested-ternary */
  clientUserId: `${signer.Id ? signer.Id : signer.clientUserId}`,
  email: `${signer.email ? signer.email : signer.HixmeEmailAlias ? signer.HixmeEmailAlias : `${(signer.FirstName).replace(/\./g, '')}.${(signer.LastName).replace(/\./g, '')}@hixmeusers.com`}`.replace(/\s+/g, '').toLowerCase(),
  name: `${signer.name ? signer.name : [signer.FirstName, signer.LastName].filter(n => n && n != null).join(' ')}`,
  recipientId: `${signer.Id ? signer.Id : signer.clientUserId}`,
  roleName: getRoleName(index),
  tabs: generateAllTabData(fields),
  userId: `${signer.Id ? signer.Id : signer.clientUserId}`,
}))

const addTabToCollection = (tabCollection = {}, type = 'text', data = {}) => {
  const existing = tabCollection[tabName(type)] || []
  tabCollection[tabName(type)] = [...existing, data]
  return tabCollection
}

export const generateAllTabData = (fields = {}) => {
  const tabs = {
    [tabName('text')]: [],
    [tabName('checkbox')]: [],
  }

  Object.keys(fields).map((key) => {
    // we have some generic checkboxes that don't contain 'checkbox' in their
    // name, but they do contain 'insurance'.
    // ALSO, depending on the plan chosen, we will have one additional checkbox
    const isCheckbox = /(?:checkbox|insurance|\s{1})/i.test(key)
    const tabLabel = `\\*${key}`
    const type = isCheckbox ? 'checkbox' : 'text'
    const value = format(fields[key])
    const valueLabel = isCheckbox ? 'selected' : 'value'
    // matches on: empty lines, blank strings, one (1) single space, and the word 'enrollmentPublicKey'
    const show = !/(?:^enrollmentPublicKey$|^\s+$|^$)/.test(value)

    return addTabToCollection(tabs, type, {
      [valueLabel]: value,
      locked: true,
      required: false,
      shared: true,
      show,
      tabLabel,
    })
  })

  return tabs
}
