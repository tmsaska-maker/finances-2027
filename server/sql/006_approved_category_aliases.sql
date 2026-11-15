-- T011: user-reviewed source mappings and mandatory/optional training dimension.
-- Source labels are exact historical labels from source spreadsheets.
-- No rewriting of transactions/obligations; only metadata.
BEGIN;
ALTER TABLE finance_categories
 ADD COLUMN IF NOT EXISTS requirement_kind text NOT NULL DEFAULT 'unspecified'
 CHECK (requirement_kind IN ('unspecified','required','optional'));

UPDATE finance_categories SET requirement_kind='required'
 WHERE id='psy_training_main_group';
UPDATE finance_categories SET requirement_kind='optional'
 WHERE id='psy_training_specialisation';

-- Only approved unambiguous mappings; historical source spelling is retained.
-- Payment method (rent bank/cash) is separate from economic expense category.
INSERT INTO category_source_aliases(project,source_file,source_label,category_id,reviewed_by)
VALUES
 ('ambulatory','Амб_Бізнес План/Видатки','Оренда приміщення договір','amb_rent','owner-approval-2026-11-15'),
 ('ambulatory','Амб_Бізнес План/Видатки','Оренда приміщення готівка','amb_rent','owner-approval-2026-11-15'),
 ('ambulatory','Амб_Бізнес План/Видатки','Програмне забезпечення','amb_software','owner-approval-2026-11-15'),
 ('ambulatory','Амб_Бізнес План/Видатки','Комунальні платежі','amb_utilities','owner-approval-2026-11-15'),
 ('ambulatory','Амб_Бізнес План/Видатки','Оплата підрядникам','amb_contractors','owner-approval-2026-11-15'),
 ('ambulatory','Амб_Бізнес План/Видатки','Реклама','amb_advertising','owner-approval-2026-11-15'),
 ('ambulatory','Амб_Бізнес План/Видатки','Зарплата персоналу','payroll','owner-approval-2026-11-15'),
 ('ambulatory','Амб_Бізнес План/Видатки','Банк','amb_bank_fees','owner-approval-2026-11-15'),
 ('screening','Скринінг_Бізнес план/Видатки','Зарплата персоналу','payroll','owner-approval-2026-11-15'),
 ('screening','Скринінг_Бізнес план/Видатки','Лабораторні обстеження','scr_lab','owner-approval-2026-11-15'),
 ('screening','Скринінг_Бізнес план/Видатки','Банк %','scr_financial_payment_fees','owner-approval-2026-11-15'),
 ('screening','Скринінг_Бізнес план/Видатки','Банк еквайринг','scr_financial_bank_acquiring','owner-approval-2026-11-15'),
 ('psychotherapy','Психотерапія_Бізнес план/Видатки','Навчання','psy_training','owner-approval-2026-11-15'),
 ('psychotherapy','Психотерапія_Бізнес план/Видатки','Основна група','psy_training_main_group','owner-approval-2026-11-15'),
 ('psychotherapy','Психотерапія_Бізнес план/Видатки','Спеціалізація','psy_training_specialisation','owner-approval-2026-11-15'),
 ('psychotherapy','Психотерапія_Бізнес план/Видатки','Терапевтична група','psy_training_therapy_group','owner-approval-2026-11-15'),
 ('personal','БЮДЖЕТ/Видатки_ПЛАН','Продукти','per_food_groceries','owner-approval-2026-11-15'),
 ('personal','БЮДЖЕТ/Видатки_ПЛАН','Кафе/бар','per_food_cafe','owner-approval-2026-11-15'),
 ('personal','БЮДЖЕТ/Видатки_ПЛАН','Курси / спеціалізації','per_learning_courses','owner-approval-2026-11-15'),
 ('personal','БЮДЖЕТ/Видатки_ПЛАН','Відсотки за кредит','per_finance_costs_loan_interest','owner-approval-2026-11-15')
ON CONFLICT (project,source_file,source_label) DO NOTHING;

INSERT INTO schema_migrations(version) VALUES(6) ON CONFLICT (version) DO NOTHING;
COMMIT;
