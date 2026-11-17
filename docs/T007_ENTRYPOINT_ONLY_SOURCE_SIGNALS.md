# T007 — відокремлення стартового коду від бібліотек

## Підстава

Ручний статичний аналіз №44163205456 показав `IMAGE_SOURCE_NODE_ENV_READ_SIGNAL=present`, `IMAGE_SOURCE_FILESYSTEM_WRITE_API_SIGNAL=present`, `SOURCE_COVERAGE=partial`. Це ознаки серед усіх прочитаних JS-файлів образу, а не підтверджена поведінка стартового коду.

## Нова діагностика

`deploy/gateway-entrypoint-source-audit.py` читає виключно приватний збережений Docker-save архів, **після** підтвердження SHA256 та образу в існуючому `inspect-gateway-snapshot`. Зі збереженого `running-container.json` визначає **лише простий прямий запуск** `node <script.js|.mjs|.cjs>` без прапорців Node і оболонок, враховуючи `WorkingDir`.

Обхід шарів відбувається послідовно; якщо стартовий файл перекривається наступним шаром, враховується остання версія. Сканер шукає тільки статичні текстові сигнатури читання `process.env` і файлових write API саме у файлі, на який вказує команда. Він не читає приватні ENV, не виконує JS і не переносить жодних даних за межі Lightsail.

Вихід — тільки allowlist:
- `FINANCE_GATEWAY_ENTRYPOINT_STARTUP_LOCATOR` = `resolved_node_script`, `unsupported_command`, `unsafe_path`, `metadata_invalid`;
- `FINANCE_GATEWAY_ENTRYPOINT_STARTUP_SOURCE` = `readable`, `missing`, `oversized`, `unavailable`;
- `FINANCE_GATEWAY_ENTRYPOINT_STARTUP_ENV_SIGNAL` / `STARTUP_WRITE_SIGNAL` = `present`, `not_seen`, `unavailable`.

Навіть `present` не доводить виконання API під час старту, а `not_seen` не виключає імпортовані модулі та динамічні функції. `unsupported_command` означає обмеження нашого аналізатора, а не непрацездатність старого шлюзу. Ніякі шляхи, імена конфігурації, код, логи програми чи секрети не виводяться.

## Контроль безпеки

Лише статична root-only операція `inspect-gateway-snapshot`, без Docker daemon, API, БД, мережі та запуску контейнерів. У CI — тільки штучні TAR-образи. Не змінюються операція `deploy`, автоматичний workflow, реальні ENV чи Caddy. Реліз і функціональний відкат залишаються blocked/unverified.

Після green CI + review/merge потрібен один ручний виклик `main` → `inspect-gateway-snapshot`, поле `approved_sha` порожнє. Не запускати `probe-gateway-offline`.
