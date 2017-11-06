import moment from 'moment'

export const getDocuSignCustomFieldData = (data) => {
  const payload = {
    /* eslint-disable key-spacing */
    carrier_company_name:                    `${data.healthBundle && (data.healthBundle.CarrierName || ' ')}`,
    carrier_plan_hios_id:                    `${data.healthBundle && (data.healthBundle.HealthPlanId || ' ')}`,
    carrier_plan_name:                       `${data.healthBundle && (data.healthBundle.PlanName || ' ')}`,
    worker_address_city:                     `${data.primary && (data.primary.City || ' ')}`,
    worker_address_county:                   `${data.primary && (data.primary.County || ' ')}`,
    worker_address_full:                     `${data.primary && (data.primary.StreetAddress || ' ')} ${data.primary && (data.primary.StreetAddressExt || ' ')}`,
    worker_address_line_1:                   `${data.primary && (data.primary.StreetAddress || ' ')}`,
    worker_address_line_2_apartment:         `${data.primary && (data.primary.StreetAddressExt || ' ')}`,
    // this isn't the "full" state name below, if that matters
    worker_address_state_full:               `${data.primary && (data.primary.StateProvince || ' ')}`,
    worker_address_state_two_letters:        `${data.primary && (data.primary.StateProvince || ' ')}`,
    worker_address_zip_code:                 `${data.primary && (data.primary.PostalCode || ' ')}`,
    worker_birthdate_day:                    `${moment(data.primary && (data.primary.DateOfBirth || ' ')).format('dddd')}`,
    worker_birthdate_dd:                     `${moment(data.primary && (data.primary.DateOfBirth || ' ')).format('DD')}`,
    worker_birthdate_full_words:             `${moment(data.primary && (data.primary.DateOfBirth || ' ')).format('MMMM MM, YYYY')}`,
    worker_birthdate_mm:                     `${moment(data.primary && (data.primary.DateOfBirth || ' ')).format('MM')}`,
    worker_birthdate_mm_dd_yyyy:             `${moment(data.primary && (data.primary.DateOfBirth || ' ')).format('MM / DD / YYYY')}`,
    worker_birthdate_month:                  `${moment(data.primary && (data.primary.DateOfBirth || ' ')).format('MMMM')}`,
    worker_birthdate_year:                   `${moment(data.primary && (data.primary.DateOfBirth || ' ')).format('YYYY')}`,
    worker_birthdate_yy:                     `${moment(data.primary && (data.primary.DateOfBirth || ' ')).format('YY')}`,
    worker_birthdate_yyyy:                   `${moment(data.primary && (data.primary.DateOfBirth || ' ')).format('YYYY')}`,
    worker_checkbox_is_daughter:             `${data.primary && (data.primary.Gender === 'Female' && (data.primary.Relationship === 'Child' || data.primary.Relationship === 'Child of Domestic Partner'))}`,
    worker_checkbox_is_son:                  `${data.primary && (data.primary.Gender === 'Male' && (data.primary.Relationship === 'Child' || data.primary.Relationship === 'Child of Domestic Partner'))}`,
    worker_checkbox_is_domestic_partner:     `${data.primary && data.primary.Relationship === 'Domestic Partner'}`,
    worker_checkbox_is_married:              `${data.primary && (data.primary.MarriageStatus === 'Married')}`,
    worker_checkbox_is_single:               `${data.primary && (data.primary.MarriageStatus === 'Single' || (data.primary.MarriageStatus !== 'Married' && data.primary.MarriageStatus !== 'Domestic Partner'))}`,
    worker_email_address:                    `${data.primary && (data.primary.EmailAddress || ' ')}`,
    worker_gender_checkbox_female:           `${data.primary && data.primary.Gender === 'Female'}`,
    worker_gender_checkbox_male:             `${data.primary && data.primary.Gender === 'Male'}`,
    worker_gender_full_word:                 `${data.primary && (data.primary.Gender || ' ')}`,
    worker_gender_only_letter:               `${data.primary && (data.primary.Gender || ' ').slice(0, 1)}`,
    worker_name_first_initial:               `${data.primary && (data.primary.FirstName || ' ').slice(0, 1)}`,
    worker_name_first_name:                  `${data.primary && (data.primary.FirstName || ' ')}`,
    worker_name_full_name:                   `${data.primary && (data.primary.FirstName || ' ')}${data.primary && ((data.primary.MiddleName ? (` ${data.primary.MiddleName} `) : ' ') || ' ')}${data.primary && (data.primary.LastName || ' ')}`,
    worker_name_last_initial:                `${data.primary && (data.primary.LastName || ' ').slice(0, 1)}`,
    worker_name_last_name:                   `${data.primary && (data.primary.LastName || ' ')}`,
    worker_name_middle_initial:              `${data.primary && (data.primary.MiddleName || ' ').slice(0, 1)}`,
    worker_name_middle_name:                 `${data.primary && (data.primary.MiddleName || ' ')}`,
    worker_phone_number_area_code:           `${data.primary && (data.primary.PhoneNumber || ' ').slice(0, 3)}`,
    // check extension below
    worker_phone_number_extension:           `${data.primary && (data.primary.PhoneNumber || ' ').slice(10, 20)}`,
    worker_phone_number_first_three:         `${data.primary && (data.primary.PhoneNumber || ' ').slice(3, 6)}`,
    worker_phone_number_full:                `${data.primary && (data.primary.PhoneNumber || ' ')}`,
    worker_phone_number_last_four:           `${data.primary && (data.primary.PhoneNumber || ' ').slice(6, 10)}`,
    // Preferred Language
    worker_preferred_language:               'English',
    worker_relationship_to_primary:          `${data.primary && (data.primary.Relationship === 'Employee' ? 'Self' : (data.primary.Relationship || ' '))}`,
    // signature?  do anything to this?
    // worker_signature:                     `${data.primary && data.primary.}`,
    worker_signature_date_dd:                `${moment().format('DD')}`,
    worker_signature_date_mm:                `${moment().format('MM')}`,
    worker_signature_date_mm_dd_yyyy:        `${moment().format('MM / DD / YYYY')}`,
    worker_signature_date_yyyy:              `${moment().format('YYYY')}`,
    worker_smoker_checkbox:                  `${data.primary && ((data.primary.Smoker || ' ') === true)}`,
    worker_smoker_checkbox_no:               `${data.primary && ((data.primary.Smoker || ' ') === false)}`,
    worker_smoker_checkbox_yes:              `${data.primary && ((data.primary.Smoker || ' ') === true)}`,
    worker_smoker_y_n:                       `${data.primary && ((data.primary.Smoker || ' ') === true ? 'Y' : 'N')}`,
    worker_smoker_yes_no:                    `${data.primary && ((data.primary.Smoker || ' ') === true ? 'YES' : 'NO')}`,
    worker_ssn_first_three_numbers:          `${data.primary && (data.primary.SSN || ' ').slice(0, 3)}`,
    worker_ssn_full_all_numbers_only:        `${data.primary && (data.primary.SSN || ' ')}`,
    worker_ssn_full_all_numbers_with_dashes: `${data.primary && (data.primary.SSN || ' ').slice(0, 3)}-${data.primary && (data.primary.SSN || ' ').slice(3, 5)}-${data.primary && (data.primary.SSNLastFour || ' ')}`,
    worker_ssn_last_four_numbers:            `${data.primary && (data.primary.SSNLastFour || ' ')}`,
    worker_ssn_middle_two_numbers:           `${data.primary && (data.primary.SSN || ' ').slice(3, 5)}`,
  }

  if (data.family) {
    data.family.forEach((person) => {
      console.dir(person)
    })
  }

  return payload
}
