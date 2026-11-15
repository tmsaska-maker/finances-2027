# T011 — initial seed review (2026-11-15)
This is a **source-derived, conservative first pass**, not a user's approval of each label, not an import of transactions, and not deployment. Display names preserve spreadsheet source spelling (including historic typos) for now. Stable technical codes are new implementation identifiers.

## Sources (read-only)
- Амбулаторія: https://docs.google.com/spreadsheets/d/1VHh6iQU2kd_qpBHSHeUua0lweTD2PFLTeLUyEQEl6Ks — `Видатки!A8:B65`
- Скринінг: https://docs.google.com/spreadsheets/d/15DBTXVw4goANbVscSK5Qpyxx4c7VhZBP7iQILUDqL88 — `Видатки!A8:B34`
- Психотерапія: https://docs.google.com/spreadsheets/d/1G6ZQtmD-HGwuSPc6epsmn04ZdpNMYSUt393eJxUix2c — `Видатки!A6:B25`
- Особистий бюджет: https://docs.google.com/spreadsheets/d/1ZrIy2sjXTxoUV-1YFKm3XD5C-uQbmwafwejgelJc4KQ — `Видатки_ПЛАН!A4:B80`

## Seed scope
- 98 distinct category/subcategory identifiers, 29 project-to-root selections and 70 project-to-subcategory selections.
- Shared payroll root `payroll` for ambulatory and screening; persons/positions do not appear as category leaves.
- Other roots are currently project-scoped rather than forcibly merging similar names. Later merge only after explicit economic-equivalence review.
- No source aliases inserted: `category_source_aliases` requires reviewed mappings and will be populated only following an approval step.
- `ON CONFLICT DO NOTHING` means existing categories and project selections are never overwritten in production. All SQL is additive; avoid running on actual data until release gates are met.

## Excluded pending business approval
- Амбулаторія: «Оренда приміщення договір/готівка» (payment method vs nature), «Оплата кредиту», «Податки на зарплату», «ЄСВза ФОП», «Військовий ФОП», «Податок з доходу», «Податковий борг», «Фінансування інших проектів», «Виведення прибутку», «Відпускні» as a separate root, and person/position labels. «Розхідні матеріали та послуги / Банк» is preserved but could later become banking fees by review.
- Скринінг: «Адміністратор, зарплата» (payroll component rather than new root), «Податки ФОП», «Податки на зарплату», «Податок з доходу», personal role names.
- Психотерапія: «Супервізор трійка» (learning vs supervision unclear), «Зарплата» (role/payroll), taxes. «Супервізор» retained as expense category pending normalization; currency and exchange-rate details stay a separate finance concern.
- Особисті: «Діти/Настя», «Діти/Стас» (people), «Податки/Податки» (tax accounting), «Борг/Погашення тіла кредиту» (liability repayment), «Накопичення та інвестиції/Долари», «Банка» (assets), «Фінансування власних проєктів/*» (transfers), «Невизначені витрати/Невідомо» (classification workflow). `БАЗА`, `СТИЛЬ ЖИТТЯ`, and `ПРОЄКТИ / ВЕЛИКІ ПОКУПКИ` are report groups, not root categories.
- Ambulatory and screening payroll taxes and FOP taxes must follow their already approved different accounting flows.

## Before enabling production
1. Confirm exclusions and proposed root/subcategory meanings with user; keep original source label and temporal mapping.
2. Verify a single category's business meaning before making it shared across projects.
3. Implement read-only API + UI selectors with project filters, no browser-only category list.
4. Do not migrate historic transaction classifications without review and traceable alias decisions.
