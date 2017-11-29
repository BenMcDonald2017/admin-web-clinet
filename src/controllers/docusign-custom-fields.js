import { get } from 'delver'
import { times as iterate } from 'lodash'
import moment from 'moment'
import us from 'us'

import {
  effectiveAge,
  getCart,
  getDocuSignApplicationTemplate,
  getPreviousPlanPolicyNumber,
} from '../resources'

const { EFFECTIVE_DATE = '2018-01-01' } = process.env

export const getDocuSignCustomFieldData = async (event) => {
  const { event: { params: { employeePublicKey = ' ' } = {} } = {} } = event
  const { Item: cart = {} } = await getCart(employeePublicKey)

  const benefit = get(event, 'benefit', {})
  let family = get(event, 'family', [])
  // const signers = get(event, 'signers', [])
  // let worker = get(event, 'worker', {})

  const { Persons: personsCoveredInThisBenefit = [] } = benefit
  const workerToUse = personsCoveredInThisBenefit.find(person => /employee/i.test(person.Relationship) && /included/i.test(person.BenefitStatus))
  const spouseToUse = personsCoveredInThisBenefit.find(person => (/(?:spouse|domestic\s*partner)/i.test(person.Relationship) && /included/i.test(person.BenefitStatus)))
  const familyMembersToUse = personsCoveredInThisBenefit.filter(person => (!/(?:employee|spouse|domestic\s*partner)/i.test(person.Relationship) && /included/i.test(person.BenefitStatus)))

  let spouse = family.find(s => s.Id === get(spouseToUse || {}, 'Id'))
  let worker = family.find(w => w.Id === get(workerToUse || {}, 'Id'))
  family = family.filter(member => familyMembersToUse.some(person => person && person.Id === get(member, 'Id')))
  const HIOS = get(benefit, 'HealthPlanId')

  const isThis = (insuranceType = '') => {
    switch (`${insuranceType}`) {
      case 'insurance_child_only':
        return !spouse && !worker && family && family.length === 1
      case 'insurance_family':
        return worker && spouse && family.length
      case 'insurance_individual_child':
        return !spouse && !worker && family && family.length === 1
      case 'insurance_individual_children':
        return !spouse && !worker && family && family.length > 1
      case 'insurance_individual_domestic_partner_children':
        return !spouse && !worker && family && family.length === 1
      case 'insurance_individual_domestic_partner':
        return !spouse && !worker && !family
      case 'insurance_individual_spouse':
        return !!spouse && !family && !family.length
      case 'insurance_individual':
        return !family || !family.length
      case 'spouse_checkbox_is_spouse':
        return !!spouse
      default:
        return false
    }
  }

  /* eslint-disable no-multi-spaces, key-spacing */
  const formFieldData = {
    carrier_company_name:                           get(benefit, 'CarrierName'),
    carrier_plan_hios_id:                           `${HIOS}`,
    carrier_plan_name:                              get(benefit, 'PlanName'),
    employee_benefit_public_key:                    get(benefit, 'BenefitPublicKey'),
    enrollment_public_key:                          get(cart, 'EnrollmentPublicKey'),
    hios_id:                                        `${HIOS}`,
    previous_carrier_plan_policy_number:            await getPreviousPlanPolicyNumber(get(worker || {}, 'EmployeePublicKey')) || ' ',
    generic_checkbox_no:                            true,
    generic_checkbox_yes:                           false,
    // need more information that what I have in here to mark the below correctly
    insurance_child_only:                           isThis('insurance_child_only'),
    insurance_family:                               isThis('insurance_family'),
    insurance_individual_child:                     isThis('insurance_individual_child'),
    insurance_individual_children:                  isThis('insurance_individual_children'),
    insurance_individual_domestic_partner_children: isThis('insurance_individual_domestic_partner_children'),
    insurance_individual_domestic_partner:          isThis('insurance_individual_domestic_partner'),
    insurance_individual_spouse:                    isThis('insurance_individual_spouse'),
    insurance_individual:                           isThis('insurance_individual'),
    spouse_is_spouse:                               isThis('spouse_is_spouse'),
  }

  // first, let's add some generic plan-related data to our DocuSign formFieldData
  const [template = {}] = await getDocuSignApplicationTemplate(`${HIOS}`)
  const { InputElement: planSpecificCheckBox = null } = template

  if (planSpecificCheckBox) {
    formFieldData[`${planSpecificCheckBox}`] = true
  }

  // The logic below re-organizes the *order* of how we're sending DocuSign the
  // actual signer- and template-data.  Consider the following example:  If a
  // `worker` chooses a plan for their `spouse`, and the `spouse` is the only
  // one covered by that plan, the `spouse` needs to be bumped into the `worker`
  // "data-space", for lack of a better term, so that the DocuSign populates the
  // `spouse`'s information into the 'Worker'/'Primary Applicant' field(s)
  // ———————————————————————————————————————————————————————————————————————————

  // if worker doesn't exist
  if (!worker || !Object.keys(worker || {}).length) {
    // if spouse exists
    if (spouse || Object.keys(spouse || {}).length) {
      // if no 'worker', make 'worker' the 'spouse' instead
      worker = spouse
      // and then assign 'spouse' to first element in 'family' array
      const [firstFamilyMember] = family
      spouse = firstFamilyMember
      // remove first family member
      family.shift()
    } else {
      // set 'worker' and 'spouse' to the two first elements in 'family'
      [worker, spouse] = family
      // then remove those two from the 'family' array
      family.shift()
      family.shift()
    }
  } else if (!spouse || !Object.keys(spouse || {}).length) {
    // if there's a `worker`, but NO `spouse`, then make `family[0]` the `spouse`
    [spouse] = family
    family.shift()
  }

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
  const isAtLeast18YearsOld = (effectiveAge(get(person, 'DateOfBirth'), EFFECTIVE_DATE)) >= 18
  const relation = get(person, 'Relationship', '')
  const SSN = get(person, 'SSN', '')
  const status = get(person, 'MarriageStatus', '')

  return {
    [`${label}_address_city`]:                      get(person, 'City'),
    [`${label}_address_county`]:                    get(person, 'County'),
    [`${label}_address_full`]:                      [get(person, 'StreetAddress'), get(person, 'StreetAddressExt')].filter(e => e && e != null).join(', '),
    [`${label}_address_line_1`]:                    get(person, 'StreetAddress'),
    [`${label}_address_line_2_apartment`]:          get(person, 'StreetAddressExt'),
    [`${label}_address_state_full`]:                get(person, 'StateProvince') && us.lookup(get(person, 'StateProvince')) && us.lookup(get(person, 'StateProvince')).name,
    [`${label}_address_state_two_letters`]:         get(person, 'StateProvince'),
    [`${label}_address_zip_code`]:                  get(person, 'PostalCode'),
    [`${label}_birthdate_day`]:                     birthdate ? moment(birthdate).format('dddd') : ' ',
    [`${label}_birthdate_dd`]:                      birthdate ? moment(birthdate).format('DD') : ' ',
    [`${label}_birthdate_full_words`]:              birthdate ? moment(birthdate).format('MMMM MM, YYYY') : ' ',
    [`${label}_birthdate_mm`]:                      birthdate ? moment(birthdate).format('MM') : ' ',
    [`${label}_birthdate_mm_dd_yyyy`]:              birthdate ? moment(birthdate).format('MM / DD / YYYY') : ' ',
    [`${label}_birthdate_month`]:                   birthdate ? moment(birthdate).format('MMMM') : ' ',
    [`${label}_birthdate_year`]:                    birthdate ? moment(birthdate).format('YYYY') : ' ',
    [`${label}_birthdate_yy`]:                      birthdate ? moment(birthdate).format('YY') : ' ',
    [`${label}_birthdate_yyyy`]:                    birthdate ? moment(birthdate).format('YYYY') : ' ',
    [`${label}_email_address`]:                     get(person, 'HixmeEmailAlias'), // NOT 'EmailAddress'
    [`${label}_gender_full_word`]:                  `${gender}`.toUpperCase(),
    [`${label}_name_first_name`]:                   get(person, 'FirstName'),
    [`${label}_name_middle_name`]:                  get(person, 'MiddleName'),
    [`${label}_name_last_name`]:                    get(person, 'LastName'),
    [`${label}_name_full_name`]:                    [get(person, 'FirstName'), get(person, 'MiddleName'), get(person, 'LastName')].filter(e => e && e != null).join(' '),
    [`${label}_name_first_initial`]:                get(person, 'FirstName', '').slice(0, 1).toUpperCase(),
    [`${label}_gender_only_letter`]:                `${gender}`.slice(0, 1).toUpperCase(),
    [`${label}_name_last_initial`]:                 get(person, 'LastName', '').slice(0, 1).toUpperCase(),
    [`${label}_name_middle_initial`]:               get(person, 'MiddleName', '').slice(0, 1).toUpperCase(),
    [`${label}_phone_number_extension`]:            get(person, 'PhoneNumber', '').slice(10, 20),
    [`${label}_phone_number_area_code`]:            get(person, 'PhoneNumber', '').slice(0, 3),
    [`${label}_phone_number_first_three`]:          get(person, 'PhoneNumber', '').slice(3, 6),
    [`${label}_phone_number_last_four`]:            get(person, 'PhoneNumber', '').slice(6, 10),
    [`${label}_phone_number_full`]:                 get(person, 'PhoneNumber'),
    [`${label}_preferred_language`]:                isPerson ? 'English' : '',
    [`${label}_relationship_to_primary`]:           relation.match(/^employee/i) ? 'Self' : relation,
    [`${label}_signature`]:                         ' ',
    [`${label}_signature_date_dd`]:                 (isPerson && isAtLeast18YearsOld) ? moment().format('DD') : ' ',
    [`${label}_signature_date_mm`]:                 (isPerson && isAtLeast18YearsOld) ? moment().format('MM') : ' ',
    [`${label}_signature_date_yyyy`]:               (isPerson && isAtLeast18YearsOld) ? moment().format('YYYY') : ' ',
    [`${label}_signature_date_mm_dd_yyyy`]:         (isPerson && isAtLeast18YearsOld) ? moment().format('MM / DD / YYYY') : ' ',
    [`${label}_smoker_y_n`]:                        (isPerson && (isSmoker ? 'Y' : 'N')) || ' ',
    [`${label}_smoker_yes_no`]:                     (isPerson && (isSmoker ? 'YES' : 'NO')) || ' ',
    [`${label}_ssn_full_all_numbers_only`]:         `${SSN}`,
    [`${label}_ssn_first_three_numbers`]:           `${SSN}`.slice(0, 3),
    [`${label}_ssn_middle_two_numbers`]:            `${SSN}`.slice(3, 5),
    [`${label}_ssn_last_four_numbers`]:             get(person, 'SSNLastFour'),
    [`${label}_ssn_full_all_numbers_with_dashes`]:  [`${SSN}`.slice(0, 3), `${SSN}`.slice(3, 5), `${get(person, 'SSNLastFour', '')}`].filter(e => e && e != null).join('-'),
    [`${label}_checkbox_is_daughter`]:              isPerson && /^female$/i.test(gender) && /^(?:child|daughter)/i.test(relation),
    [`${label}_checkbox_is_son`]:                   isPerson && /^male$/i.test(gender) && /^(?:child|son)/i.test(relation),
    [`${label}_checkbox_is_domestic_partner`]:      isPerson && /^domestic\s*partner$/i.test(relation),
    [`${label}_checkbox_is_married`]:               isPerson && /^married$/i.test(status),
    // check 'single' if person exists, and isn't ' married', in a 'domestic partner[ship]',
    // or otherwise has a status of 'single'
    [`${label}_checkbox_is_single`]:                isPerson && (!/^(?:married|domestic\s*partner)$/i.test(status) || /^single$/i.test(status)),
    [`${label}_gender_checkbox_female`]:            isPerson && /^female$/i.test(gender),
    [`${label}_gender_checkbox_male`]:              isPerson && /^male$/i.test(gender),
    [`${label}_smoker_checkbox_yes`]:              isPerson && isSmoker,
    [`${label}_smoker_checkbox_no`]:              isPerson && !isSmoker,
    [`${label}_smoker_checkbox`]:                   isPerson && isSmoker,
    [`${label}_is_at_least_18_years_old_checkbox`]: isPerson && isAtLeast18YearsOld,
  }
}
