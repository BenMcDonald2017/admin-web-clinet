import Delver from 'delver'
import moment from 'moment'
import us from 'us'

export const getDocuSignCustomFieldData = (data) => {
  const worker = data.primary
  const spouse = data.family.find((person) => {
    const relation = Delver.get(person, 'Relationship')
    return Delver.get(person, 'IncludedInMedical') === true &&
      (relation === 'Spouse' || relation === 'Domestic Partner')
  })
  const family = data.family.filter((person) => {
    const relation = Delver.get(person, 'Relationship')
    return Delver.get(person, 'IncludedInMedical') === true &&
      (relation !== 'Employee' && relation !== 'Spouse' && relation !== 'Domestic Partner')
  })

  const payload = {}

  /* eslint-disable no-multi-spaces */
  // first, let's add some generic plan-related data to our DocuSign payload
  payload.carrier_company_name = Delver.get(data.healthBundle, 'CarrierName')
  payload.carrier_plan_hios_id = Delver.get(data.healthBundle, 'HealthPlanId')
  payload.carrier_plan_name    = Delver.get(data.healthBundle, 'PlanName')

  // add worker and spouse to payload
  Object.assign(payload, fetchAndFillDataFor(worker, 'worker'))
  Object.assign(payload, fetchAndFillDataFor(spouse, 'spouse'))

  // add family members and up to 6 blank dependents
  for (let i = 0; i < 6; i += 1) {
    const familyMember = family ? family[i] : {}
    Object.assign(payload, fetchAndFillDataFor(familyMember, `dep${i + 1}`))
  }

  function fetchAndFillDataFor(person, type) {
    person = person === undefined ? {} : person
    return {
      /* eslint-disable key-spacing */
      [`${type}_address_city`]:                     Delver.get(person, 'City'),
      [`${type}_address_county`]:                   Delver.get(person, 'County'),
      [`${type}_address_full`]:                     `${Delver.get(person, 'StreetAddress')}${Delver.get(person, 'StreetAddressExt') ? `, ${Delver.get(person, 'StreetAddressExt')}` : ''}`,
      [`${type}_address_line_1`]:                   Delver.get(person, 'StreetAddress'),
      [`${type}_address_line_2_apartment`]:         Delver.get(person, 'StreetAddressExt'),
      [`${type}_address_state_full`]:               us.lookup(Delver.get(person, 'StateProvince')) && us.lookup(Delver.get(person, 'StateProvince')).name,
      [`${type}_address_state_two_letters`]:        Delver.get(person, 'StateProvince'),
      [`${type}_address_zip_code`]:                 Delver.get(person, 'PostalCode'),
      [`${type}_birthdate_day`]:                    Delver.get(person, 'DateOfBirth') ? moment(Delver.get(person, 'DateOfBirth')).format('dddd') : ' ',
      [`${type}_birthdate_dd`]:                     Delver.get(person, 'DateOfBirth') ? moment(Delver.get(person, 'DateOfBirth')).format('DD') : ' ',
      [`${type}_birthdate_full_words`]:             Delver.get(person, 'DateOfBirth') ? moment(Delver.get(person, 'DateOfBirth')).format('MMMM MM, YYYY') : ' ',
      [`${type}_birthdate_mm`]:                     Delver.get(person, 'DateOfBirth') ? moment(Delver.get(person, 'DateOfBirth')).format('MM') : ' ',
      [`${type}_birthdate_mm_dd_yyyy`]:             Delver.get(person, 'DateOfBirth') ? moment(Delver.get(person, 'DateOfBirth')).format('MM / DD / YYYY') : ' ',
      [`${type}_birthdate_month`]:                  Delver.get(person, 'DateOfBirth') ? moment(Delver.get(person, 'DateOfBirth')).format('MMMM') : ' ',
      [`${type}_birthdate_year`]:                   Delver.get(person, 'DateOfBirth') ? moment(Delver.get(person, 'DateOfBirth')).format('YYYY') : ' ',
      [`${type}_birthdate_yy`]:                     Delver.get(person, 'DateOfBirth') ? moment(Delver.get(person, 'DateOfBirth')).format('YY') : ' ',
      [`${type}_birthdate_yyyy`]:                   Delver.get(person, 'DateOfBirth') ? moment(Delver.get(person, 'DateOfBirth')).format('YYYY') : ' ',
      [`${type}_checkbox_is_daughter`]:             Delver.get(person, 'Gender') === 'Female' && (Delver.get(person, 'Relationship') === 'Child' || Delver.get(person, 'Relationship') === 'Child of Domestic Partner'),
      [`${type}_checkbox_is_son`]:                  Delver.get(person, 'Gender') === 'Male' && (Delver.get(person, 'Relationship') === 'Child' || Delver.get(person, 'Relationship') === 'Child of Domestic Partner'),
      [`${type}_checkbox_is_domestic_partner`]:     Delver.get(person, 'Relationship') === 'Domestic Partner',
      [`${type}_checkbox_is_married`]:              Delver.get(person, 'MarriageStatus') === 'Married',
      [`${type}_checkbox_is_single`]:               Delver.get(person, 'MarriageStatus') === 'Single' || (Delver.get(person, 'MarriageStatus') !== 'Married' && Delver.get(person, 'MarriageStatus') !== 'Domestic Partner'),
      [`${type}_email_address`]:                    Delver.get(person, 'EmailAddress'),
      [`${type}_gender_checkbox_female`]:           Delver.get(person, 'Gender') === 'Female',
      [`${type}_gender_checkbox_male`]:             Delver.get(person, 'Gender') === 'Male',
      [`${type}_gender_full_word`]:                 Delver.get(person, 'Gender'),
      [`${type}_gender_only_letter`]:               Delver.get(person, 'Gender') ? Delver.get(person, 'Gender').slice(0, 1) : ' ',
      [`${type}_name_first_initial`]:               Delver.get(person, 'FirstName') ? Delver.get(person, 'FirstName').slice(0, 1) : ' ',
      [`${type}_name_first_name`]:                  Delver.get(person, 'FirstName'),
      [`${type}_name_full_name`]:                   `${Delver.get(person, 'FirstName')}${Delver.get(person, 'MiddleName') ? ` ${Delver.get(person, 'MiddleName')} ` : ' '}${Delver.get(person, 'LastName')}`,
      [`${type}_name_last_initial`]:                Delver.get(person, 'LastName') ? Delver.get(person, 'LastName').slice(0, 1) : ' ',
      [`${type}_name_last_name`]:                   Delver.get(person, 'LastName'),
      [`${type}_name_middle_initial`]:              Delver.get(person, 'MiddleName') ? Delver.get(person, 'MiddleName').slice(0, 1) : ' ',
      [`${type}_name_middle_name`]:                 Delver.get(person, 'MiddleName'),
      [`${type}_phone_number_area_code`]:           Delver.get(person, 'PhoneNumber') ? Delver.get(person, 'PhoneNumber').slice(0, 3) : ' ',
      // check extension below
      [`${type}_phone_number_extension`]:           Delver.get(person, 'PhoneNumber') ? Delver.get(person, 'PhoneNumber').slice(10, 20) : ' ',
      [`${type}_phone_number_first_three`]:         Delver.get(person, 'PhoneNumber') ? Delver.get(person, 'PhoneNumber').slice(3, 6) : ' ',
      [`${type}_phone_number_full`]:                Delver.get(person, 'PhoneNumber'),
      [`${type}_phone_number_last_four`]:           Delver.get(person, 'PhoneNumber') ? Delver.get(person, 'PhoneNumber').slice(6, 10) : ' ',
      [`${type}_preferred_language`]:               'English',
      [`${type}_relationship_to_primary`]:          Delver.get(person, 'Relationship') === 'Employee' ? 'Self' : Delver.get(person, 'Relationship'),
      // signature?  do anything to this?
      [`${type}_signature`]:                        !!person,
      [`${type}_signature_date_dd`]:                person && moment().format('DD'),
      [`${type}_signature_date_mm`]:                person && moment().format('MM'),
      [`${type}_signature_date_mm_dd_yyyy`]:        person && moment().format('MM / DD / YYYY'),
      [`${type}_signature_date_yyyy`]:              person && moment().format('YYYY'),
      [`${type}_smoker_checkbox`]:                  Delver.get(person, 'Smoker') === true,
      [`${type}_smoker_checkbox_no`]:               Delver.get(person, 'Smoker') === false,
      [`${type}_smoker_checkbox_yes`]:              Delver.get(person, 'Smoker') === true,
      [`${type}_smoker_y_n`]:                       Delver.get(person, 'Smoker') === true ? 'Y' : 'N',
      [`${type}_smoker_yes_no`]:                    Delver.get(person, 'Smoker') === true ? 'YES' : 'NO',
      [`${type}_ssn_full_all_numbers_only`]:        Delver.get(person, 'SSN'),
      [`${type}_ssn_first_three_numbers`]:          Delver.get(person, 'SSN') ? Delver.get(person, 'SSN').slice(0, 3) : ' ',
      [`${type}_ssn_middle_two_numbers`]:           Delver.get(person, 'SSN') ? Delver.get(person, 'SSN').slice(3, 5) : ' ',
      [`${type}_ssn_last_four_numbers`]:            Delver.get(person, 'SSNLastFour'),
      [`${type}_ssn_full_all_numbers_with_dashes`]: Delver.get(person, 'SSN') ? `${Delver.get(person, 'SSN').slice(0, 3)}-${Delver.get(person, 'SSN').slice(3, 5)}-${Delver.get(person, 'SSNLastFour')}` : ' ',
    }
  }

  // change all `undefined`s (and empty strings) to blank spaces (' ') for DocuSign
  Object.keys(payload).forEach((entry) => {
    const value = payload[entry]
    payload[entry] = (value === undefined || value === '') ? ' ' : value
  })

  return payload
}
