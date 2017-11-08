import { get } from 'delver'
import moment from 'moment'
import us from 'us'

const isBoolean = value => typeof value === typeof true
const isNumber = value => !!(value === 0 || (!Number.isNaN(value) && Number(value)))
const isSomething = value => isBoolean(value) || isNumber(value) || (value && value != null)

export const getDocuSignCustomFieldData = (data) => {
  const { healthBundle } = data
  const worker = data.primary
  const spouse = data.family.find((person) => {
    const relation = get(person, 'Relationship')
    return get(person, 'IncludedInMedical') === true &&
      (relation === 'Spouse' || relation === 'Domestic Partner')
  })
  const family = data.family.filter((person) => {
    const relation = get(person, 'Relationship')
    return get(person, 'IncludedInMedical') === true &&
      (relation !== 'Employee' && relation !== 'Spouse' && relation !== 'Domestic Partner')
  })

  const formFieldData = {}

  /* eslint-disable no-multi-spaces */
  // first, let's add some generic plan-related data to our DocuSign formFieldData
  formFieldData.carrier_company_name = get(healthBundle, 'CarrierName')
  // TODO: check key name for plan HIOS ID
  formFieldData.carrier_plan_hios_id = get(healthBundle, 'PlanHIOS')
  formFieldData.carrier_plan_name    = get(healthBundle, 'PlanName')
  formFieldData.generic_checkbox_no  = false
  formFieldData.generic_checkbox_yes = true


  // add worker and spouse to formFieldData
  Object.assign(
    formFieldData,
    fetchAndFillDataFor(worker, 'worker'),
    fetchAndFillDataFor(spouse, 'spouse'),
  )

  // add family members and up to 6 blank dependents
  for (let i = 0; i < 6; i += 1) {
    const familyMember = family ? family[i] : {}
    Object.assign(formFieldData, fetchAndFillDataFor(familyMember, `dep${i + 1}`))
  }

  function fetchAndFillDataFor(person, type) {
    person = person === undefined ? {} : person
    return {
      /* eslint-disable key-spacing */
      [`${type}_address_city`]:                     get(person, 'City'),
      [`${type}_address_county`]:                   get(person, 'County'),
      [`${type}_address_full`]:                     `${get(person, 'StreetAddress')}${get(person, 'StreetAddressExt') ? `, ${get(person, 'StreetAddressExt')}` : ''}`,
      [`${type}_address_line_1`]:                   get(person, 'StreetAddress'),
      [`${type}_address_line_2_apartment`]:         get(person, 'StreetAddressExt'),
      [`${type}_address_state_full`]:               get(person, 'StateProvince') && us.lookup(get(person, 'StateProvince')) && us.lookup(get(person, 'StateProvince')).name,
      [`${type}_address_state_two_letters`]:        get(person, 'StateProvince'),
      [`${type}_address_zip_code`]:                 get(person, 'PostalCode'),
      [`${type}_birthdate_day`]:                    get(person, 'DateOfBirth') ? moment(get(person, 'DateOfBirth')).format('dddd') : ' ',
      [`${type}_birthdate_dd`]:                     get(person, 'DateOfBirth') ? moment(get(person, 'DateOfBirth')).format('DD') : ' ',
      [`${type}_birthdate_full_words`]:             get(person, 'DateOfBirth') ? moment(get(person, 'DateOfBirth')).format('MMMM MM, YYYY') : ' ',
      [`${type}_birthdate_mm`]:                     get(person, 'DateOfBirth') ? moment(get(person, 'DateOfBirth')).format('MM') : ' ',
      [`${type}_birthdate_mm_dd_yyyy`]:             get(person, 'DateOfBirth') ? moment(get(person, 'DateOfBirth')).format('MM / DD / YYYY') : ' ',
      [`${type}_birthdate_month`]:                  get(person, 'DateOfBirth') ? moment(get(person, 'DateOfBirth')).format('MMMM') : ' ',
      [`${type}_birthdate_year`]:                   get(person, 'DateOfBirth') ? moment(get(person, 'DateOfBirth')).format('YYYY') : ' ',
      [`${type}_birthdate_yy`]:                     get(person, 'DateOfBirth') ? moment(get(person, 'DateOfBirth')).format('YY') : ' ',
      [`${type}_birthdate_yyyy`]:                   get(person, 'DateOfBirth') ? moment(get(person, 'DateOfBirth')).format('YYYY') : ' ',
      [`${type}_checkbox_is_daughter`]:             get(person, 'Gender') === 'Female' && (get(person, 'Relationship') === 'Child' || get(person, 'Relationship') === 'Child of Domestic Partner'),
      [`${type}_checkbox_is_son`]:                  get(person, 'Gender') === 'Male' && (get(person, 'Relationship') === 'Child' || get(person, 'Relationship') === 'Child of Domestic Partner'),
      [`${type}_checkbox_is_domestic_partner`]:     get(person, 'Relationship') === 'Domestic Partner',
      [`${type}_checkbox_is_married`]:              get(person, 'MarriageStatus') === 'Married',
      [`${type}_checkbox_is_single`]:               get(person, 'MarriageStatus') === 'Single' || (get(person, 'MarriageStatus') !== 'Married' && get(person, 'MarriageStatus') !== 'Domestic Partner'),
      [`${type}_email_address`]:                    get(person, 'HixmeEmailAlias'), // NOT 'EmailAddress'
      [`${type}_gender_checkbox_female`]:           get(person, 'Gender') === 'Female',
      [`${type}_gender_checkbox_male`]:             get(person, 'Gender') === 'Male',
      [`${type}_gender_full_word`]:                 get(person, 'Gender'),
      [`${type}_name_first_name`]:                  get(person, 'FirstName'),
      [`${type}_name_middle_name`]:                 get(person, 'MiddleName'),
      [`${type}_name_last_name`]:                   get(person, 'LastName'),
      [`${type}_name_full_name`]:                   `${get(person, 'FirstName')}${get(person, 'MiddleName') ? ` ${get(person, 'MiddleName')} ` : ' '}${get(person, 'LastName')}`,
      [`${type}_name_first_initial`]:               get(person, 'FirstName', '').slice(0, 1).toUpperCase(),
      [`${type}_gender_only_letter`]:               get(person, 'Gender', '').slice(0, 1).toUpperCase(),
      [`${type}_name_last_initial`]:                get(person, 'LastName', '').slice(0, 1).toUpperCase(),
      [`${type}_name_middle_initial`]:              get(person, 'MiddleName', '').slice(0, 1).toUpperCase(),
      [`${type}_phone_number_extension`]:           get(person, 'PhoneNumber', '').slice(10, 20),
      [`${type}_phone_number_area_code`]:           get(person, 'PhoneNumber', '').slice(0, 3),
      [`${type}_phone_number_first_three`]:         get(person, 'PhoneNumber', '').slice(3, 6),
      [`${type}_phone_number_last_four`]:           get(person, 'PhoneNumber', '').slice(6, 10),
      [`${type}_phone_number_full`]:                get(person, 'PhoneNumber'),
      [`${type}_preferred_language`]:               'English',
      [`${type}_relationship_to_primary`]:          get(person, 'Relationship') === 'Employee' ? 'Self' : get(person, 'Relationship'),
      // signature?  do anything to this? KEEPING IT BLANK FOR NOW
      [`${type}_signature`]:                        '',
      [`${type}_signature_date_dd`]:                get(person, 'SSN') ? moment().format('DD') : '',
      [`${type}_signature_date_mm`]:                get(person, 'SSN') ? moment().format('MM') : '',
      [`${type}_signature_date_mm_dd_yyyy`]:        get(person, 'SSN') ? moment().format('MM / DD / YYYY') : '',
      [`${type}_signature_date_yyyy`]:              get(person, 'SSN') ? moment().format('YYYY') : '',
      [`${type}_smoker_checkbox`]:                  get(person, 'Smoker') === true,
      [`${type}_smoker_checkbox_no`]:               get(person, 'Smoker') === false,
      [`${type}_smoker_checkbox_yes`]:              get(person, 'Smoker') === true,
      [`${type}_smoker_y_n`]:                       get(person, 'Smoker') === true ? 'Y' : 'N',
      [`${type}_smoker_yes_no`]:                    get(person, 'Smoker') === true ? 'YES' : 'NO',
      [`${type}_ssn_full_all_numbers_only`]:        get(person, 'SSN'),
      [`${type}_ssn_first_three_numbers`]:          get(person, 'SSN') ? get(person, 'SSN').slice(0, 3) : ' ',
      [`${type}_ssn_middle_two_numbers`]:           get(person, 'SSN') ? get(person, 'SSN').slice(3, 5) : ' ',
      [`${type}_ssn_last_four_numbers`]:            get(person, 'SSNLastFour'),
      [`${type}_ssn_full_all_numbers_with_dashes`]: get(person, 'SSN') ? `${get(person, 'SSN', '').slice(0, 3)}-${get(person, 'SSN', '').slice(3, 5)}-${get(person, 'SSNLastFour', '')}` : '',
    }
  }

  // change all `undefined`s (and empty strings) to blank spaces (' ') for DocuSign
  Object.keys(formFieldData).forEach((entry) => {
    const value = formFieldData[entry]
    // if value is something we want (string, boolean, or number), return it
    // otherwise, return a single space string
    formFieldData[entry] = isSomething(value) ? value : ' '
  })

  return formFieldData
}
