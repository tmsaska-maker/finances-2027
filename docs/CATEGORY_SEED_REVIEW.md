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


## Користувацькі рішення — узгоджено 2026-11-15
- **Амбулаторія / оренда:** одна категорія «Оренда приміщення», один об'єкт оренди, дві частини платежу — половина переказом на рахунок, половина готівкою після зняття коштів. **Зняття готівки саме по собі не є витратою на оренду**: це переказ між рахунками/касою. Окремий факт готівкового розрахунку за оренду — витрата (за наявності підтвердження/ручного запису) та погашення орендного зобов'язання, без дублювання зі зняттям.
- **Кредити:** погашення тіла — зміна боргу (не повторне придбання обладнання); відсотки/комісії — фінансові витрати.
- **ЄСВ 22%:** витрата/зобов'язання роботодавця, пов'язана з нарахованою/виплачуваною зарплатою; **ЄСВ ФОП** — окрема категорія податкових зобов'язань ФОП, не податок найманих працівників. Податки ФОП обліковуються в єдиному податковому контурі; управлінський розподіл за проєктами окремий.
- **Інші пропозиції щодо Амбулаторії та Скринінгу** з обговорення категорій підтверджені користувачкою: податковий борг — стан зобов'язання; міжпроєктне фінансування/виведення коштів — трансфери; відпускні, премії, оплата платних прийомів — компоненти нарахування; «Банк» у розхідних матеріалах — фінансові витрати. Скринінг «Банк %» = комісія банку за платежі, а «Банк еквайринг» — комісія еквайрингу. Два рядки лишаються окремими там, де їх відмінність підтверджена.
- **Психотерапія:** «Основна група» — **обов'язкове професійне навчання**, «Спеціалізація» — **додаткове**; «Терапевтична група» залишається окремою підкатегорією професійного навчання. Усі три підкатегорії мають бути видимими окремо у плані й звітах, не зливати їх в одне «Навчання». «Зарплата» означала **власну винагороду ФОП**, а не зарплату найманого працівника; обліковувати як нараховану/виплачену власну винагороду з відповідною звіркою бізнесового й особистого контурів. «Супервізор трійка» лишається для уточнення конкретної природи (супервізія чи навчальна складова), його не канонізувати без підтвердження.
- **Особистий бюджет:** переносимо **всі** економічно коректні підкатегорії з `Видатки_ПЛАН`, не лише рядки «БАЗА». Зокрема зберігаємо «СТИЛЬ ЖИТТЯ», «ПРОЄКТИ / ВЕЛИКІ ПОКУПКИ» як групи відображення, а їх дочірні **категорії та підкатегорії** (кафе, краса, одяг, вокал, навчання, благодійність, подорожі, авто тощо) — як повноправні варіанти класифікації. Групи витрат і типи рухів — різні виміри.
- Особисті **«Діти»** — категорія витрат; «Настя/Стас» — отримувач/особа, не підкатегорія. Особисті податки відокремити від ФОП; погашення основної суми боргу, накопичення/банка/купівля валюти, фінансування власних проєктів — окремі фінансові операції, але мають залишатися видимими у звітах і плануванні, а не зникнути. «Невідомо» — тимчасовий статус класифікації.
- **Ще не додано в SQL 004:** оренда як одна категорія, розділені податкові й власні компенсаційні контури, категорія «Діти» з аналітикою отримувача та неприбуткові рухи. Окремі дочірні категорії Психотерапії вже існують у seed, але «обов'язкове/додаткове» поки не представлене структурованим атрибутом. Не стверджувати, що вся економічна модель уже реалізована.
