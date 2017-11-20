import { capitalize, camelCase } from 'lodash'

export const DOCUSIGN_ROLE_NAMES = [
  'worker', 'spouse', 'dep1', 'dep2', 'dep3', 'dep4', 'dep5', 'dep6',
]

const isBoolean = value => typeof value === typeof true
const isNumber = value => !!(value === 0 || (!Number.isNaN(value) && Number(value)))
const isSomething = value => isBoolean(value) || isNumber(value) || (value && value != null)
const revertToType = content => ((isBoolean(content) || isNumber(content)) ? content : `${content}`)

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

export const format = content => (isSomething(content) ? revertToType(content) : ' ')

export const generateSigners = (signers = [], fields = {}) => signers.map((signer, index) => ({
  roleName: getRoleName(index),
  name: `${signer.name ? signer.name : [signer.FirstName, signer.MiddleName, signer.LastName].filter(e => e && e != null).join(' ')}`,
  email: `${signer.email ? signer.email : signer.HixmeEmailAlias}`.toLowerCase(),
  clientUserId: `${signer.clientUserId}`,
  userId: `${signer.clientUserId}`,
  recipientId: `${signer.clientUserId}`,
  tabs: generateAllTabData(fields),
  // recipientId: `${index + 1}`, // i = 0 at first; so we add 1
}))

const tabName = (name = 'text') => camelCase(`${name}Tabs`)

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
    const value = fields[key]
    const valueLabel = isCheckbox ? 'selected' : 'value'
    // ALSO: 'required', 'senderRequired', 'templateRequired', 'templateLocked'

    return addTabToCollection(tabs, type, {
      [valueLabel]: format(value),
      tabLabel,
      locked: true,
      shared: true,
    })
  })

  return tabs
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
