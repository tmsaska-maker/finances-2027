# Ручний деплой «Фінанси 2027» через GitHub Actions

**Мердж** = код у `main`. **Деплой** = контрольований запуск змін на AWS Lightsail і застосування SQL у фінансовій PostgreSQL. Мердж не запускає деплой.

## Кнопка
GitHub → [Actions](https://github.com/tmsaska-maker/finances-2027/actions) → **Manual finance T011 deploy (Lightsail)** → **Run workflow** (обрати гілку `main`).

- `preflight`: перевіряє доступ до Lightsail, структуру **окремого** фінансового Docker Compose, стан бази та її SQL-версії. Не змінює базу, контейнери чи фінансовий сайт.
- `deploy`: вимагає `approved_sha` — повний 40-символьний SHA вибраного `main` коміту; проходить CI, створює Docker image фінансового API на GitHub runner, створює backup PostgreSQL + перевіряє restore у **тимчасовій** фінансовій БД, перевіряє захищене S3-сховище, копіює backup у S3 із шифруванням, перевіряє його і лише після цього застосовує SQL 003–006 та перезапускає **лише finance api**. Після — автентифікований health + finance categories smoke test.
- Автоматичного деплою після мерджу **немає**. Відсутні змінні AWS, права, S3 bucket, правильні каталоги чи живі перевірки = **FAIL**, без спроби змінити Screen­ing40.

## Одноразове налаштування GitHub Actions (GitHub → Settings → Secrets and variables → Actions → Variables)
1. `FINANCES_LIGHTSAIL_INSTANCE_NAME`: існуючий Lightsail instance, на якому є фінансова Docker stack (без створення нового).
2. `FINANCES_AWS_DEPLOY_ROLE_ARN`: нова обмежена AWS IAM Role **у тому самому AWS-акаунті та з уже наявним OIDC-провайдером**, її trust policy дозволяє тільки репозиторій `tmsaska-maker/finances-2027` на `refs/heads/main`. Наявна роль Скринінгу має вузьку trust policy саме для нього, тому не копіювати її ARN. Дозволи до *того самого* Lightsail instance та **лише** до `finance/postgresql/*` в наявному S3. Не використовувати постійні AWS access keys. Приклад політик: `infra/aws/finance-github-oidc-trust.template.json` та `infra/aws/finance-deploy-policy.template.json`.
3. `FINANCES_BACKUP_BUCKET`: **наявний** приватний S3-бакет (з поточної конфігурації Скринінгу — `screening40-staging-backups`, перевірити його наявність в AWS). **НЕ створювати новий бакет**. Для фінансів використовується лише `finance/postgresql/`, а Скринінг зберігає поточний `staging/postgresql/`. Спільні bucket versioning, Block Public Access і AES256 encryption. Фінансовій ролі надавати S3 PutObject/ GetObject (для HeadObject) **лише** на `finance/postgresql/*`; для перевірок бакета — bucket-level GetBucketVersioning/GetBucketPublicAccessBlock/GetEncryptionConfiguration. Перевірити lifecycle для `finance/postgresql/` (наприклад 30 днів), щоб бекапи не накопичувалися.
4. На існуючому Lightsail має бути `/opt/finances-2027/backend/compose.yaml` і **приватний** `.env` (не в GitHub), окрема мережа, compose project name `finances2027`, services `db` і `api`, існуючі міграції `1,2`. Права користувача Lightsail дозволяють `sudo` для контрольованого finance deploy. **Не редагувати** Screening40 compose, `/opt/screening40` або порт `8080`.

Сценарій використовує AWS Lightsail тимчасові SSH credentials, pinned host keys, відкриває порт 22 тільки для runner `/32` і закриває у `always()`. Дані backup не публікуються як GitHub artifact і тимчасово видаляються з runner.

## Критичні обмеження
- Сценарій деплоїть **SQL та приватний finance API**, **не** змінює Figma сайт і не виконує T007. UI потребує окремо погодженого деплою без заміни дизайну.
- На новому API `GET /categories?project=personal&type=income` працює лише в межах того самого приватного автентифікованого finance gateway. Реальні фінансові дані поки не вводити.
- SQL версії 003–006 є адитивними. Історичні фінансові записи автоматично не змінюються.
- Після невдалого деплою **не відновлювати всю живу БД автоматично** — перевірити стан і збережену зашифровану копію, відновлення потребує окремого контрольованого рішення. Docker image SHA записується в `/opt/finances-2027/finance-api-deployed-sha`, override — у `backend/compose.finance-release.yaml`.
- Для повторного деплою того самого SHA backup ім'я не перезаписується; сценарій зупиниться. Якщо структура реального сервера відрізняється від очікуваної, `preflight` зупиниться, а змінювати шлях/конфігурацію без ревізії не можна.

Перевірити `preflight` **перед першим** `deploy`. Поки GitHub variables/AWS role/bucket не підтверджені, готовий workflow у GitHub — **це ще не виконаний деплой**.

## Важливе про один сервер і копії
Один Lightsail, один S3-бакет, але фінансова БД — **окрема** і не повинна ділити таблиці/томи з Screening40. Це **не дубль застосунку**. Перед зміною SQL потрібна відновлювана резервна копія саме фінансової БД; тимчасові копії на runner і в /tmp очищаються. S3 має lifecycle `finance/postgresql/` для контрольованого зберігання. Окрема IAM роль обмежує GitHub-вхід, однак SSH+sudo на спільному хості технічно має ширші права — вимоги до скриптів і code review лишаються критично важливими.
