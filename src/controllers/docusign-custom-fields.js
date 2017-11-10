import { get } from 'delver'
import { times as iterate } from 'lodash'
import moment from 'moment'
import us from 'us'
import { createDocuSignEnvelope } from './docusign-ceremony-creators'

export const getDocuSignCustomFieldData = (data) => {
  const { benefit, worker } = data
  let { family = [], spouse = {} } = data

  spouse = family.find((person) => {
    const relation = get(person, 'Relationship')
    return get(person, 'IncludedInMedical') === true &&
      (relation === 'Spouse' || relation === 'Domestic Partner')
  })

  family = family.filter((person) => {
    const relation = get(person, 'Relationship')
    return get(person, 'IncludedInMedical') === true &&
      (relation !== 'Employee' && relation !== 'Spouse' && relation !== 'Domestic Partner')
  })

  const formFieldData = {}

  /* eslint-disable no-multi-spaces */
  // first, let's add some generic plan-related data to our DocuSign formFieldData
  formFieldData.carrier_company_name = get(benefit, 'CarrierName')

  // TODO: check key name for plan HIOS ID
  formFieldData.carrier_plan_hios_id = get(benefit, 'HealthPlanId')
  formFieldData.carrier_plan_name    = get(benefit, 'PlanName')

  // FIXME: checkbox payload below needs to be re-formated
  formFieldData.generic_checkbox_no  = false
  formFieldData.generic_checkbox_yes = true

  function getDep(member) { return family[member] || {} }

  // add worker and spouse to formFieldData
  Object.assign(
    formFieldData,
    fetchAndFillDataFor(worker, 'worker'),
    fetchAndFillDataFor(spouse, 'spouse'),
    ...iterate(6, i => fetchAndFillDataFor(getDep(i), `dep${i + 1}`)),
  )

  return formFieldData
}

function fetchAndFillDataFor(person = {}, type = '') {
  const birthdate = get(person, 'DateOfBirth')
  const gender = get(person, 'Gender', '')
  const isPerson = !!get(person, 'SSN')
  const isSmoker = !!get(person, 'Smoker')
  const relation = get(person, 'Relationship', '')
  const SSN = get(person, 'SSN', '')
  const status = get(person, 'MarriageStatus', '')

  return {
    /* eslint-disable key-spacing */
    [`${type}_address_city`]:                     get(person, 'City'),
    [`${type}_address_county`]:                   get(person, 'County'),
    [`${type}_address_full`]:                     [get(person, 'StreetAddress'), get(person, 'StreetAddressExt')].filter(e => e && e != null).join(','),
    [`${type}_address_line_1`]:                   get(person, 'StreetAddress'),
    [`${type}_address_line_2_apartment`]:         get(person, 'StreetAddressExt'),
    [`${type}_address_state_full`]:               get(person, 'StateProvince') && us.lookup(get(person, 'StateProvince')) && us.lookup(get(person, 'StateProvince')).name,
    [`${type}_address_state_two_letters`]:        get(person, 'StateProvince'),
    [`${type}_address_zip_code`]:                 get(person, 'PostalCode'),
    [`${type}_birthdate_day`]:                    birthdate ? moment(birthdate).format('dddd') : ' ',
    [`${type}_birthdate_dd`]:                     birthdate ? moment(birthdate).format('DD') : ' ',
    [`${type}_birthdate_full_words`]:             birthdate ? moment(birthdate).format('MMMM MM, YYYY') : ' ',
    [`${type}_birthdate_mm`]:                     birthdate ? moment(birthdate).format('MM') : ' ',
    [`${type}_birthdate_mm_dd_yyyy`]:             birthdate ? moment(birthdate).format('MM / DD / YYYY') : ' ',
    [`${type}_birthdate_month`]:                  birthdate ? moment(birthdate).format('MMMM') : ' ',
    [`${type}_birthdate_year`]:                   birthdate ? moment(birthdate).format('YYYY') : ' ',
    [`${type}_birthdate_yy`]:                     birthdate ? moment(birthdate).format('YY') : ' ',
    [`${type}_birthdate_yyyy`]:                   birthdate ? moment(birthdate).format('YYYY') : ' ',
    [`${type}_checkbox_is_daughter`]:             gender.match(/^female/i) && relation.match(/^child/i),
    [`${type}_checkbox_is_son`]:                  gender.match(/^male/i) && relation.match(/^child/i),
    [`${type}_checkbox_is_domestic_partner`]:     relation === 'Domestic Partner',
    [`${type}_checkbox_is_married`]:              status === 'Married',
    [`${type}_checkbox_is_single`]:               status === 'Single' || (status !== 'Married' && status !== 'Domestic Partner'),
    [`${type}_email_address`]:                    get(person, 'HixmeEmailAlias'), // NOT 'EmailAddress'
    [`${type}_gender_checkbox_female`]:           gender.match(/^female/i),
    [`${type}_gender_checkbox_male`]:             gender.match(/^male/i),
    [`${type}_gender_full_word`]:                 gender.toUpperCase(),
    [`${type}_name_first_name`]:                  get(person, 'FirstName'),
    [`${type}_name_middle_name`]:                 get(person, 'MiddleName'),
    [`${type}_name_last_name`]:                   get(person, 'LastName'),
    [`${type}_name_full_name`]:                   [get(person, 'FirstName'), get(person, 'MiddleName'), get(person, 'LastName')].filter(e => e && e != null).join(' '),
    [`${type}_name_first_initial`]:               get(person, 'FirstName', '').slice(0, 1).toUpperCase(),
    [`${type}_gender_only_letter`]:               gender.slice(0, 1).toUpperCase(),
    [`${type}_name_last_initial`]:                get(person, 'LastName', '').slice(0, 1).toUpperCase(),
    [`${type}_name_middle_initial`]:              get(person, 'MiddleName', '').slice(0, 1).toUpperCase(),
    [`${type}_phone_number_extension`]:           get(person, 'PhoneNumber', '').slice(10, 20),
    [`${type}_phone_number_area_code`]:           get(person, 'PhoneNumber', '').slice(0, 3),
    [`${type}_phone_number_first_three`]:         get(person, 'PhoneNumber', '').slice(3, 6),
    [`${type}_phone_number_last_four`]:           get(person, 'PhoneNumber', '').slice(6, 10),
    [`${type}_phone_number_full`]:                get(person, 'PhoneNumber'),
    [`${type}_preferred_language`]:               isPerson ? 'English' : '',
    [`${type}_relationship_to_primary`]:          relation.match(/^employee/i) ? 'Self' : relation,
    // signature?  do anything to this? KEEPING IT BLANK FOR NOW
    [`${type}_signature`]:                        '',
    [`${type}_signature_date_dd`]:                isPerson ? moment().format('DD') : '',
    [`${type}_signature_date_mm`]:                isPerson ? moment().format('MM') : '',
    [`${type}_signature_date_mm_dd_yyyy`]:        isPerson ? moment().format('MM / DD / YYYY') : '',
    [`${type}_signature_date_yyyy`]:              isPerson ? moment().format('YYYY') : '',
    [`${type}_smoker_checkbox`]:                  isPerson && isSmoker,
    [`${type}_smoker_checkbox_no`]:               isPerson && !isSmoker,
    [`${type}_smoker_checkbox_yes`]:              isPerson && isSmoker,
    [`${type}_smoker_y_n`]:                       (isPerson && isSmoker) ? 'Y' : 'N',
    [`${type}_smoker_yes_no`]:                    (isPerson && isSmoker) ? 'YES' : 'NO',
    [`${type}_ssn_full_all_numbers_only`]:        SSN,
    [`${type}_ssn_first_three_numbers`]:          SSN.slice(0, 3),
    [`${type}_ssn_middle_two_numbers`]:           SSN.slice(3, 5),
    [`${type}_ssn_last_four_numbers`]:            get(person, 'SSNLastFour'),
    [`${type}_ssn_full_all_numbers_with_dashes`]: [SSN.slice(0, 3), SSN.slice(3, 5), get(person, 'SSNLastFour', '')].filter(e => e && e != null).join('-'),
  }
}
