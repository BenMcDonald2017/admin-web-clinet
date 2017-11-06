import moment from 'moment'
import Delver from 'delver'

export const getDocuSignCustomFieldData = (data) => {
  const worker = new Delver(data.primary)
  const healthBundle = new Delver(data.healthBundle)
  const spouse = new Delver(data.family.find(person => Delver.get(person, 'Relationship') === 'Spouse'))

  console.dir(spouse)
  console.warn(`Spouse name is ${spouse.get('FirstName')} ${spouse.get('LastName')}`)

  const payload = {
    /* eslint-disable key-spacing */
    carrier_company_name:                    healthBundle.get('CarrierName'),
    carrier_plan_hios_id:                    healthBundle.get('HealthPlanId'),
    carrier_plan_name:                       healthBundle.get('PlanName'),

    worker_address_city:                     worker.get('City'),
    worker_address_county:                   worker.get('County'),
    worker_address_full:                     `${worker.get('StreetAddress')}${worker.get('StreetAddressExt') ? `, ${worker.get('StreetAddressExt')}` : ''}`,
    worker_address_line_1:                   worker.get('StreetAddress'),
    worker_address_line_2_apartment:         worker.get('StreetAddressExt'),
    // this isn't the "full" state name below, if that matters
    worker_address_state_full:               worker.get('StateProvince'),
    worker_address_state_two_letters:        worker.get('StateProvince'),
    worker_address_zip_code:                 worker.get('PostalCode'),
    worker_birthdate_day:                    worker.get('DateOfBirth') ? moment(worker.get('DateOfBirth')).format('dddd') : ' ',
    worker_birthdate_dd:                     worker.get('DateOfBirth') ? moment(worker.get('DateOfBirth')).format('DD') : ' ',
    worker_birthdate_full_words:             worker.get('DateOfBirth') ? moment(worker.get('DateOfBirth')).format('MMMM MM, YYYY') : ' ',
    worker_birthdate_mm:                     worker.get('DateOfBirth') ? moment(worker.get('DateOfBirth')).format('MM') : ' ',
    worker_birthdate_mm_dd_yyyy:             worker.get('DateOfBirth') ? moment(worker.get('DateOfBirth')).format('MM / DD / YYYY') : ' ',
    worker_birthdate_month:                  worker.get('DateOfBirth') ? moment(worker.get('DateOfBirth')).format('MMMM') : ' ',
    worker_birthdate_year:                   worker.get('DateOfBirth') ? moment(worker.get('DateOfBirth')).format('YYYY') : ' ',
    worker_birthdate_yy:                     worker.get('DateOfBirth') ? moment(worker.get('DateOfBirth')).format('YY') : ' ',
    worker_birthdate_yyyy:                   worker.get('DateOfBirth') ? moment(worker.get('DateOfBirth')).format('YYYY') : ' ',
    worker_checkbox_is_daughter:             worker.get('Gender') === 'Female' && (worker.get('Relationship') === 'Child' || worker.get('Relationship') === 'Child of Domestic Partner'),
    worker_checkbox_is_son:                  worker.get('Gender') === 'Male' && (worker.get('Relationship') === 'Child' || worker.get('Relationship') === 'Child of Domestic Partner'),
    worker_checkbox_is_domestic_partner:     worker.get('Relationship') === 'Domestic Partner',
    worker_checkbox_is_married:              worker.get('MarriageStatus') === 'Married',
    worker_checkbox_is_single:               worker.get('MarriageStatus') === 'Single' || (worker.get('MarriageStatus') !== 'Married' && worker.get('MarriageStatus') !== 'Domestic Partner'),
    worker_email_address:                    worker.get('EmailAddress'),
    worker_gender_checkbox_female:           worker.get('Gender') === 'Female',
    worker_gender_checkbox_male:             worker.get('Gender') === 'Male',
    worker_gender_full_word:                 worker.get('Gender'),
    worker_gender_only_letter:               worker.get('Gender') ? worker.get('Gender').slice(0, 1) : ' ',
    worker_name_first_initial:               worker.get('FirstName').slice(0, 1),
    worker_name_first_name:                  worker.get('FirstName'),
    worker_name_full_name:                   `${worker.get('FirstName')}${worker.get('MiddleName') ? ` ${worker.get('MiddleName')} ` : ' '}${worker.get('LastName')}`,
    worker_name_last_initial:                worker.get('LastName') ? worker.get('LastName').slice(0, 1) : ' ',
    worker_name_last_name:                   worker.get('LastName'),
    worker_name_middle_initial:              worker.get('MiddleName') ? worker.get('MiddleName').slice(0, 1) : ' ',
    worker_name_middle_name:                 worker.get('MiddleName'),
    worker_phone_number_area_code:           worker.get('PhoneNumber') ? worker.get('PhoneNumber').slice(0, 3) : ' ',
    // check extension below
    worker_phone_number_extension:           worker.get('PhoneNumber') ? worker.get('PhoneNumber').slice(10, 20) : ' ',
    worker_phone_number_first_three:         worker.get('PhoneNumber') ? worker.get('PhoneNumber').slice(3, 6) : ' ',
    worker_phone_number_full:                worker.get('PhoneNumber'),
    worker_phone_number_last_four:           worker.get('PhoneNumber') ? worker.get('PhoneNumber').slice(6, 10) : ' ',
    // Preferred Language
    worker_preferred_language:               'English',
    worker_relationship_to_primary:          worker.get('Relationship') === 'Employee' ? 'Self' : worker.get('Relationship'),
    // signature?  do anything to this?
    // worker_signature:                        ` `,
    worker_signature_date_dd:                moment().format('DD'),
    worker_signature_date_mm:                moment().format('MM'),
    worker_signature_date_mm_dd_yyyy:        moment().format('MM / DD / YYYY'),
    worker_signature_date_yyyy:              moment().format('YYYY'),
    worker_smoker_checkbox:                  worker.get('Smoker') === true,
    worker_smoker_checkbox_no:               worker.get('Smoker') === false,
    worker_smoker_checkbox_yes:              worker.get('Smoker') === true,
    worker_smoker_y_n:                       worker.get('Smoker') === true ? 'Y' : 'N',
    worker_smoker_yes_no:                    worker.get('Smoker') === true ? 'YES' : 'NO',
    worker_ssn_full_all_numbers_only:        worker.get('SSN'),
    worker_ssn_first_three_numbers:          worker.get('SSN') ? worker.get('SSN').slice(0, 3) : ' ',
    worker_ssn_middle_two_numbers:           worker.get('SSN') ? worker.get('SSN').slice(3, 5) : ' ',
    worker_ssn_last_four_numbers:            worker.get('SSNLastFour'),
    worker_ssn_full_all_numbers_with_dashes: worker.get('SSN') ? `${worker.get('SSN').slice(0, 3)}-${worker.get('SSN').slice(3, 5)}-${worker.get('SSNLastFour')}` : ' ',
  }

  // if (data.family) {
  //   data.family.forEach((person) => {
  //     console.dir(person)
  //   })
  // }

  // change all `undefined`s (and empty strings) to blank spaces (' ') for DocuSign
  Object.keys(payload).forEach((entry) => {
    const value = payload[entry]
    payload[entry] = (value === undefined || value === '') ? ' ' : value
  })

  return payload
}
