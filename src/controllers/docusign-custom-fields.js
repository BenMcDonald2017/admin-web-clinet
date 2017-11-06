export const getDocuSignCustomFieldData = data => ({
  carrier_company_name: `${data.healthBundle && data.healthBundle.CarrierName}`,
  carrier_plan_hios_id: `${data.healthBundle && data.healthBundle.HealthPlanId}`,
  carrier_plan_name: `${data.healthBundle && data.healthBundle.PlanName}`,
})
