# T007 — порівняння запуску збереженого контейнера і Docker image

## Чому потрібна ця перевірка

У пробному запуску збереженого старого образу ми використовували **дефолтні** Docker image Entrypoint/Cmd з вигаданими ENV, без live-конфігурації. Процес завершився exit 1. Статичні перевірки підтвердили цілісність snapshot і наявність додаткового чутливого ENV, але **не встановили причину**. Важлива альтернатива: старий **робочий контейнер** міг стартувати з перевизначеними командою, робочою директорією або користувачем, а також із файловими залежностями, яких немає в ізольованій пробі.

## Що додаємо

`deploy/gateway-saved-startup-delta.py` — чистий Python-класифікатор **двох уже наявних у root-only snapshot** об'єктів `running-container.json` і `running-image.json`. Він не торкається Docker, мережі чи API і не повертає значення приватних налаштувань.

Існуюча ручна операція `inspect-gateway-snapshot` після перевірки SHA256 архіву та image ID додатково друкує **тільки**:

- `FINANCE_GATEWAY_STARTUP_COMMAND_OVERRIDE`: `same` / `different` / `unavailable` — порівняння Entrypoint **та** Cmd;
- `FINANCE_GATEWAY_STARTUP_WORKING_DIRECTORY_OVERRIDE`: `same` / `different` / `unavailable`;
- `FINANCE_GATEWAY_STARTUP_USER_OVERRIDE`: `same` / `different` / `unavailable`;
- `FINANCE_GATEWAY_STARTUP_MOUNT_DEPENDENCY`: `none` / `present` / `unavailable` — наявність live mounts або binds;
- `FINANCE_GATEWAY_STARTUP_TMPFS_DEPENDENCY`: `none` / `present` / `unavailable`;
- `FINANCE_GATEWAY_STARTUP_LIVE_ROOTFS_POLICY`: `read_only` / `writable` / `unavailable`.

Навіть `same` не доводить, що синтетична конфігурація достатня. `present` для mount/tmpfs не дає підстав копіювати файли або підключати production resources. `writable` повідомляє **лише** політику живого контейнера, не доводить фактичну потребу запису в root filesystem. Поле `unavailable` — явна відсутність достатніх метаданих, не «немає залежності».

## Захист і порядок роботи

- Поки лише draft PR і CI: всі тести — синтетичні, запуску на Lightsail немає.
- Після green CI, review та merge: GitHub Actions → Manual finance T011 deploy (Lightsail) → Run workflow → branch `main` → `operation=inspect-gateway-snapshot` → порожній `approved_sha`. **Не** `deploy`, **не** `probe-gateway-offline`.
- Snapshot вміст лишається на Lightsail. Код перевірки не виводить команди, користувачів, шляхи, назви ENV, секрети або JSON. Перед друком усі класи суворо перевіряються за allowlist.
- Робочий gateway, API, DB, Caddy, Screening40 не змінюються. Після перевірки залишається `production_rollback=unverified`; реліз заблокований.

## Як використати результат

Якщо `COMMAND_OVERRIDE=different` або `WORKING_DIRECTORY_OVERRIDE=different`, причина exit 1 може бути пов'язана з використанням image defaults замість live overrides; потрібне окреме **джерельно підтверджене** пояснення, а не автоматична підстановка live-значень.

Якщо `MOUNT_DEPENDENCY=present`, ізольований запуск без mounts міг не мати необхідних файлів; **не** переносити або монтувати реальні файли у пробний контейнер.

Якщо всі класи `same/none`, залишаються непідтверджені синтетичні конфігураційні параметри та автентичний HTTP-контракт. Жодний результат цього статичного етапу сам по собі не дозволяє повторний запуск старого образу чи release.
