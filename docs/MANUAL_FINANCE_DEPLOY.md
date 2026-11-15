# Ручний деплой «Фінанси 2027» через GitHub Actions

**Мердж** = код у `main`. **Деплой** = контрольований запуск змін на AWS Lightsail і застосування SQL у фінансовій PostgreSQL. Мердж не запускає деплой.

## Кнопка
GitHub → [Actions](https://github.com/tmsaska-maker/finances-2027/actions) → **Manual finance T011 deploy (Lightsail)** → **Run workflow** (обрати гілку `main`).

- `preflight`: перевіряє доступ до Lightsail, структуру **окремого** фінансового Docker Compose, стан бази та її SQL-версії. Не змінює базу, контейнери чи фінансовий сайт.
- `deploy`: вимагає `approved_sha` — повний 40-символьний SHA вибраного `main` коміту; проходить CI, створює Docker image фінансового API на GitHub runner, створює backup PostgreSQL + перевіряє restore у **тимчасовій** фінансовій БД, перевіряє захищене S3-сховище, копіює backup у S3 із шифруванням, перевіряє його і лише після цього застосовує SQL 003–006 та перезапускає **лише finance api**. Після — автентифікований health + finance categories smoke test.
- Автоматичного деплою після мерджу **немає**. Відсутні змінні AWS, права, S3 bucket, правильні каталоги чи живі перевірки = **FAIL**, без спроби змінити Screen­ing40.

## Одноразове налаштування GitHub Actions (GitHub → Settings → Secrets and variables → Actions → Variables)
1. `FINANCES_LIGHTSAIL_INSTANCE_NAME`: існуючий Lightsail instance, на якому є фінансова Docker stack (без створення нового).
2. `FINANCES_AWS_DEPLOY_ROLE_ARN`: окрема мінімальна AWS IAM Role для GitHub OIDC, довіра — **саме до репозиторію** `tmsaska-maker/finances-2027` на `refs/heads/main`. Не копіювати довіру від Screening40 без змін. Політика: обмежити Lightsail SSH access/Open/Close до потрібного instance, S3 write/verify лише до finance bucket/prefix. Не використовувати постійні AWS access keys.
3. `FINANCES_BACKUP_BUCKET`: **окреме** непублічне S3-сховище для finance backups, versioning Enabled, Block Public Access all true, bucket AES256 encryption, tag `Project=Finances2027`. Для цього сценарію потрібен IAM доступ до `GetBucketVersioning`, `GetPublicAccessBlock`, `GetBucketEncryption`, `GetBucketTagging`, `PutObject`, `HeadObject`.
4. На існуючому Lightsail має бути `/opt/finances-2027/backend/compose.yaml` і **приватний** `.env` (не в GitHub), окрема мережа, compose project name `finances2027`, services `db` і `api`, існуючі міграції `1,2`. Права користувача Lightsail дозволяють `sudo` для контрольованого finance deploy. **Не редагувати** Screening40 compose, `/opt/screening40` або порт `8080`.

Сценарій використовує AWS Lightsail тимчасові SSH credentials, pinned host keys, відкриває порт 22 тільки для runner `/32` і закриває у `always()`. Дані backup не публікуються як GitHub artifact і тимчасово видаляються з runner.

## Критичні обмеження
- Сценарій деплоїть **SQL та приватний finance API**, **не** змінює Figma сайт і не виконує T007. UI потребує окремо погодженого деплою без заміни дизайну.
- На новому API `GET /categories?project=personal&type=income` працює лише в межах того самого приватного автентифікованого finance gateway. Реальні фінансові дані поки не вводити.
- SQL версії 003–006 є адитивними. Історичні фінансові записи автоматично не змінюються.
- Після невдалого деплою **не відновлювати всю живу БД автоматично** — перевірити стан і збережену зашифровану копію, відновлення потребує окремого контрольованого рішення. Docker image SHA записується в `/opt/finances-2027/finance-api-deployed-sha`, override — у `backend/compose.finance-release.yaml`.
- Для повторного деплою того самого SHA backup ім'я не перезаписується; сценарій зупиниться. Якщо структура реального сервера відрізняється від очікуваної, `preflight` зупиниться, а змінювати шлях/конфігурацію без ревізії не можна.

Перевірити `preflight` **перед першим** `deploy`. Поки GitHub variables/AWS role/bucket не підтверджені, готовий workflow у GitHub — **це ще не виконаний деплой**.
