import { get } from 'delver'
import { times as iterate } from 'lodash'
import moment from 'moment'
import us from 'us'

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
  formFieldData.carrier_plan_hios_id = get(benefit, 'HealthPlanId')
  formFieldData.carrier_plan_name    = get(benefit, 'PlanName')
  // the below two are used to check generic 'yes' and 'no' boxes where applicable
  formFieldData.generic_checkbox_no = false
  formFieldData.generic_checkbox_yes = true

  const getFamilyMember = index => get({ family }, `family[${index}]`, {})

  // add worker and spouse to formFieldData
  Object.assign(
    formFieldData,
    fetchAndFillDataFor(worker, 'worker'),
    fetchAndFillDataFor(spouse, 'spouse'),
    ...iterate(6, i => fetchAndFillDataFor(getFamilyMember(i), `dep${i + 1}`)),
  )

  return formFieldData
}

function fetchAndFillDataFor(person = {}, label = '') {
  const birthdate = get(person, 'DateOfBirth')
  const gender = get(person, 'Gender', '')
  const isPerson = !!get(person, 'SSN')
  const isSmoker = !!get(person, 'Smoker')
  const relation = get(person, 'Relationship', '')
  const SSN = get(person, 'SSN', '')
  const status = get(person, 'MarriageStatus', '')

  return {
    /* eslint-disable key-spacing */
    [`${label}_address_city`]:                     get(person, 'City'),
    [`${label}_address_county`]:                   get(person, 'County'),
    [`${label}_address_full`]:                     [get(person, 'StreetAddress'), get(person, 'StreetAddressExt')].filter(e => e && e != null).join(','),
    [`${label}_address_line_1`]:                   get(person, 'StreetAddress'),
    [`${label}_address_line_2_apartment`]:         get(person, 'StreetAddressExt'),
    [`${label}_address_state_full`]:               get(person, 'StateProvince') && us.lookup(get(person, 'StateProvince')) && us.lookup(get(person, 'StateProvince')).name,
    [`${label}_address_state_two_letters`]:        get(person, 'StateProvince'),
    [`${label}_address_zip_code`]:                 get(person, 'PostalCode'),
    [`${label}_birthdate_day`]:                    birthdate ? moment(birthdate).format('dddd') : ' ',
    [`${label}_birthdate_dd`]:                     birthdate ? moment(birthdate).format('DD') : ' ',
    [`${label}_birthdate_full_words`]:             birthdate ? moment(birthdate).format('MMMM MM, YYYY') : ' ',
    [`${label}_birthdate_mm`]:                     birthdate ? moment(birthdate).format('MM') : ' ',
    [`${label}_birthdate_mm_dd_yyyy`]:             birthdate ? moment(birthdate).format('MM / DD / YYYY') : ' ',
    [`${label}_birthdate_month`]:                  birthdate ? moment(birthdate).format('MMMM') : ' ',
    [`${label}_birthdate_year`]:                   birthdate ? moment(birthdate).format('YYYY') : ' ',
    [`${label}_birthdate_yy`]:                     birthdate ? moment(birthdate).format('YY') : ' ',
    [`${label}_birthdate_yyyy`]:                   birthdate ? moment(birthdate).format('YYYY') : ' ',
    [`${label}_email_address`]:                    get(person, 'HixmeEmailAlias'), // NOT 'EmailAddress'
    [`${label}_gender_full_word`]:                 gender.toUpperCase(),
    [`${label}_name_first_name`]:                  get(person, 'FirstName'),
    [`${label}_name_middle_name`]:                 get(person, 'MiddleName'),
    [`${label}_name_last_name`]:                   get(person, 'LastName'),
    [`${label}_name_full_name`]:                   [get(person, 'FirstName'), get(person, 'MiddleName'), get(person, 'LastName')].filter(e => e && e != null).join(' '),
    [`${label}_name_first_initial`]:               get(person, 'FirstName', '').slice(0, 1).toUpperCase(),
    [`${label}_gender_only_letter`]:               gender.slice(0, 1).toUpperCase(),
    [`${label}_name_last_initial`]:                get(person, 'LastName', '').slice(0, 1).toUpperCase(),
    [`${label}_name_middle_initial`]:              get(person, 'MiddleName', '').slice(0, 1).toUpperCase(),
    [`${label}_phone_number_extension`]:           get(person, 'PhoneNumber', '').slice(10, 20),
    [`${label}_phone_number_area_code`]:           get(person, 'PhoneNumber', '').slice(0, 3),
    [`${label}_phone_number_first_three`]:         get(person, 'PhoneNumber', '').slice(3, 6),
    [`${label}_phone_number_last_four`]:           get(person, 'PhoneNumber', '').slice(6, 10),
    [`${label}_phone_number_full`]:                get(person, 'PhoneNumber'),
    [`${label}_preferred_language`]:               isPerson ? 'English' : '',
    [`${label}_relationship_to_primary`]:          relation.match(/^employee/i) ? 'Self' : relation,
    [`${label}_signature`]:                        ' ',
    [`${label}_signature_date_dd`]:                isPerson ? moment().format('DD') : '',
    [`${label}_signature_date_mm`]:                isPerson ? moment().format('MM') : '',
    [`${label}_signature_date_mm_dd_yyyy`]:        isPerson ? moment().format('MM / DD / YYYY') : '',
    [`${label}_signature_date_yyyy`]:              isPerson ? moment().format('YYYY') : '',
    [`${label}_smoker_y_n`]:                       (isPerson && (isSmoker ? 'Y' : 'N')) || '',
    [`${label}_smoker_yes_no`]:                    (isPerson && (isSmoker ? 'YES' : 'NO')) || '',
    [`${label}_ssn_full_all_numbers_only`]:        SSN,
    [`${label}_ssn_first_three_numbers`]:          SSN.slice(0, 3),
    [`${label}_ssn_middle_two_numbers`]:           SSN.slice(3, 5),
    [`${label}_ssn_last_four_numbers`]:            get(person, 'SSNLastFour'),
    [`${label}_ssn_full_all_numbers_with_dashes`]: [SSN.slice(0, 3), SSN.slice(3, 5), get(person, 'SSNLastFour', '')].filter(e => e && e != null).join('-'),
    [`${label}_checkbox_is_daughter`]:             isPerson && /^female$/i.test(gender) && /^(?:child|daughter)/i.test(relation),
    [`${label}_checkbox_is_son`]:                  isPerson && /^male$/i.test(gender) && /^(?:child|son)/i.test(relation),
    [`${label}_checkbox_is_domestic_partner`]:     isPerson && /^domestic\s*partner$/i.test(relation),
    [`${label}_checkbox_is_married`]:              isPerson && /^married$/i.test(status),
    // check 'single' if person exists, and isn't 'married', in a 'domestic partner[ship]', or otherwise has a status of 'single'
    [`${label}_checkbox_is_single`]:               isPerson && (!/^(?:married|domestic\s*partner)$/i.test(status) || /^single$/i.test(status)),
    [`${label}_gender_checkbox_female`]:           isPerson && /^female$/i.test(gender),
    [`${label}_gender_checkbox_male`]:             isPerson && /^male$/i.test(gender),
    [`${label}_smoker_checkbox`]:                  isPerson && isSmoker,
  }
}
