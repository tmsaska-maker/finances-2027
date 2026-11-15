-- T011: approved expanded personal finance classification and income sources.
-- Inflows from owned business projects are internal financing (non_consumption),
-- NOT new consolidated income. Bank withdrawals/FX/debt repayments are NOT expenses.
-- These records are selectable vocabulary only; existing transactions remain untouched.
BEGIN;

INSERT INTO finance_categories(id,code,name,parent_id,economic_type)
VALUES
  ('per_children', 'per_children', 'Діти', NULL, 'expense'),
  ('per_taxes', 'per_taxes', 'Особисті податки', NULL, 'expense'),
  ('per_rental_income', 'per_rental_income', 'Орендні надходження', NULL, 'income'),
  ('per_help_income', 'per_help_income', 'Фінансова допомога та подарунки', NULL, 'income'),
  ('per_investment_income', 'per_investment_income', 'Інвестиційні доходи', NULL, 'income'),
  ('per_other_income', 'per_other_income', 'Інші зовнішні надходження', NULL, 'income'),
  ('per_owner_draws', 'per_owner_draws', 'Власна винагорода з бізнесу', NULL, 'non_consumption'),
  ('per_reimbursements', 'per_reimbursements', 'Відшкодування витрат', NULL, 'non_consumption'),
  ('per_debt_principal', 'per_debt_principal', 'Погашення тіла боргу', NULL, 'non_consumption'),
  ('per_savings', 'per_savings', 'Накопичення та конвертація активів', NULL, 'non_consumption'),
  ('per_project_funding', 'per_project_funding', 'Фінансування власних проєктів', NULL, 'non_consumption'),
  ('amb_rent', 'amb_rent', 'Оренда приміщення', NULL, 'expense'),
  ('amb_bank_fees', 'amb_bank_fees', 'Банківські комісії', NULL, 'expense')
ON CONFLICT (id) DO NOTHING;

INSERT INTO finance_categories(id,code,name,parent_id,economic_type)
VALUES
  ('per_food_delivery', 'per_food_delivery', 'Доставка готової їжі', 'per_food', 'expense'),
  ('per_housing_repair', 'per_housing_repair', 'Ремонт і облаштування', 'per_housing', 'expense'),
  ('per_housing_furniture_appliances', 'per_housing_furniture_appliances', 'Меблі й техніка', 'per_housing', 'expense'),
  ('per_transport_parking_roads', 'per_transport_parking_roads', 'Паркування / платні дороги', 'per_transport', 'expense'),
  ('per_health_dentistry', 'per_health_dentistry', 'Стоматологія', 'per_health', 'expense'),
  ('per_health_prevention', 'per_health_prevention', 'Профілактика', 'per_health', 'expense'),
  ('per_pets_grooming', 'per_pets_grooming', 'Грумінг', 'per_pets', 'expense'),
  ('per_pets_accessories', 'per_pets_accessories', 'Аксесуари й обладнання', 'per_pets', 'expense'),
  ('per_beauty_hairdresser', 'per_beauty_hairdresser', 'Перукарня', 'per_beauty', 'expense'),
  ('per_beauty_cosmetology', 'per_beauty_cosmetology', 'Косметологія', 'per_beauty', 'expense'),
  ('per_leisure_culture', 'per_leisure_culture', 'Театр / культурні події', 'per_leisure', 'expense'),
  ('per_leisure_dancing', 'per_leisure_dancing', 'Танці', 'per_leisure', 'expense'),
  ('per_learning_conferences', 'per_learning_conferences', 'Конференції та професійні події', 'per_learning', 'expense'),
  ('per_charity_zsu', 'per_charity_zsu', 'ЗСУ', 'per_charity', 'expense'),
  ('per_charity_other_charity', 'per_charity_other_charity', 'Інша благодійність', 'per_charity', 'expense'),
  ('per_rental_income_kyiv', 'per_rental_income_kyiv', 'Орендна плата Київ', 'per_rental_income', 'income'),
  ('per_help_income_assistance', 'per_help_income_assistance', 'Фінансова допомога', 'per_help_income', 'income'),
  ('per_help_income_cash_gifts', 'per_help_income_cash_gifts', 'Грошові подарунки', 'per_help_income', 'income'),
  ('per_investment_income_deposit_interest', 'per_investment_income_deposit_interest', 'Відсотки за депозитом', 'per_investment_income', 'income'),
  ('per_investment_income_account_interest', 'per_investment_income_account_interest', 'Відсотки на залишок', 'per_investment_income', 'income'),
  ('per_other_income_irregular', 'per_other_income_irregular', 'Разові зовнішні надходження', 'per_other_income', 'income'),
  ('per_owner_draws_ambulatory', 'per_owner_draws_ambulatory', 'Амбулаторія', 'per_owner_draws', 'non_consumption'),
  ('per_owner_draws_screening', 'per_owner_draws_screening', 'Скринінг', 'per_owner_draws', 'non_consumption'),
  ('per_owner_draws_psychotherapy', 'per_owner_draws_psychotherapy', 'Психотерапія', 'per_owner_draws', 'non_consumption'),
  ('per_owner_draws_groups', 'per_owner_draws_groups', 'Групи', 'per_owner_draws', 'non_consumption'),
  ('per_reimbursements_tenant_utilities', 'per_reimbursements_tenant_utilities', 'Комунальні від орендаря', 'per_reimbursements', 'non_consumption'),
  ('per_reimbursements_repaid_costs', 'per_reimbursements_repaid_costs', 'Повернення власних витрат', 'per_reimbursements', 'non_consumption'),
  ('per_debt_principal_loan', 'per_debt_principal_loan', 'Погашення тіла кредиту', 'per_debt_principal', 'non_consumption'),
  ('per_savings_fx', 'per_savings_fx', 'Купівля валюти', 'per_savings', 'non_consumption'),
  ('per_savings_jar', 'per_savings_jar', 'Поповнення накопичувального рахунку', 'per_savings', 'non_consumption'),
  ('per_project_funding_ambulatory', 'per_project_funding_ambulatory', 'Амбулаторія', 'per_project_funding', 'non_consumption'),
  ('per_project_funding_screening', 'per_project_funding_screening', 'Скринінг 40+', 'per_project_funding', 'non_consumption'),
  ('per_project_funding_psychotherapy', 'per_project_funding_psychotherapy', 'Психотерапія', 'per_project_funding', 'non_consumption'),
  ('per_project_funding_groups', 'per_project_funding_groups', 'Групи', 'per_project_funding', 'non_consumption')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_category_access(project,category_id)
VALUES
  ('personal', 'per_children'),
  ('personal', 'per_taxes'),
  ('personal', 'per_rental_income'),
  ('personal', 'per_help_income'),
  ('personal', 'per_investment_income'),
  ('personal', 'per_other_income'),
  ('personal', 'per_owner_draws'),
  ('personal', 'per_reimbursements'),
  ('personal', 'per_debt_principal'),
  ('personal', 'per_savings'),
  ('personal', 'per_project_funding'),
  ('ambulatory', 'amb_rent'),
  ('ambulatory', 'amb_bank_fees'),
  ('personal', 'per_food_delivery'),
  ('personal', 'per_housing_repair'),
  ('personal', 'per_housing_furniture_appliances'),
  ('personal', 'per_transport_parking_roads'),
  ('personal', 'per_health_dentistry'),
  ('personal', 'per_health_prevention'),
  ('personal', 'per_pets_grooming'),
  ('personal', 'per_pets_accessories'),
  ('personal', 'per_beauty_hairdresser'),
  ('personal', 'per_beauty_cosmetology'),
  ('personal', 'per_leisure_culture'),
  ('personal', 'per_leisure_dancing'),
  ('personal', 'per_learning_conferences'),
  ('personal', 'per_charity_zsu'),
  ('personal', 'per_charity_other_charity'),
  ('personal', 'per_rental_income_kyiv'),
  ('personal', 'per_help_income_assistance'),
  ('personal', 'per_help_income_cash_gifts'),
  ('personal', 'per_investment_income_deposit_interest'),
  ('personal', 'per_investment_income_account_interest'),
  ('personal', 'per_other_income_irregular'),
  ('personal', 'per_owner_draws_ambulatory'),
  ('personal', 'per_owner_draws_screening'),
  ('personal', 'per_owner_draws_psychotherapy'),
  ('personal', 'per_owner_draws_groups'),
  ('personal', 'per_reimbursements_tenant_utilities'),
  ('personal', 'per_reimbursements_repaid_costs'),
  ('personal', 'per_debt_principal_loan'),
  ('personal', 'per_savings_fx'),
  ('personal', 'per_savings_jar'),
  ('personal', 'per_project_funding_ambulatory'),
  ('personal', 'per_project_funding_screening'),
  ('personal', 'per_project_funding_psychotherapy'),
  ('personal', 'per_project_funding_groups')
ON CONFLICT (project,category_id) DO NOTHING;

-- Source labels and historical aliases are deliberately not generated.
INSERT INTO schema_migrations(version) VALUES(5) ON CONFLICT(version) DO NOTHING;
COMMIT;
