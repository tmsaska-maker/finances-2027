# T007 — статичні сигнали з приватного архіву старого gateway

## Навіщо

Ручна операція №44157701559 довела, що у збереженого live-контейнера **немає** перевизначення команди запуску, робочої директорії чи користувача відносно image defaults; відсутні mounts і tmpfs. Live RootFS `writable` означає лише дозвіл на запис, **не** його необхідність. Додаткові sensitive ENV присутні, але жодного реального секрету не можна підставляти в пробний запуск.

## Новий крок

Модуль `deploy/gateway-image-source-signals.py` без запуску Docker і без extraction на диск читає **тільки вже перевірений SHA256-архів** `original-gateway-image.tar` на самому Lightsail. У Docker-save manifest шукає звичайні JS/MJS/CJS-файли в шарах та класифікує **лише** наявність статичних текстових сигнатур:

- `FINANCE_GATEWAY_IMAGE_SOURCE_SOURCE_COVERAGE`: `scanned`, `no_candidate_source`, `partial`, `unsupported`.
- `FINANCE_GATEWAY_IMAGE_SOURCE_NODE_ENV_READ_SIGNAL`: `present`, `not_seen`, `unavailable`.
- `FINANCE_GATEWAY_IMAGE_SOURCE_FILESYSTEM_WRITE_API_SIGNAL`: `present`, `not_seen`, `unavailable`.

Це **не** пошук секретів, не повернення назв ENV та не доказ причини exit 1. `present` означає лише збіг із текстовим шаблоном, у тому числі потенційно в залежності чи коментарі. `not_seen` обмежене охопленими кандидатними файлами і не означає «запису немає». `partial` / `unsupported` — недостатні дані; не робити висновку про runtime.

### Захист

- Підпорядковано поточному `inspect-gateway-snapshot`: точний SHA snapshot, root-only права, без symlink, image ID та повна перевірка SHA256 архіву **до** аналізу.
- Розбір Docker TAR виключно в пам'яті; не записує image files, не виконує програму. Не звертається до Docker daemon, мережі, API, БД або Caddy.
- Тільки звичайні JS/MJS/CJS файли, без абсолютних шляхів/переходів `..`, обмеження кількості шарів, кількості членів TAR, розміру одного файлу та загальної кількості прочитаного source.
- У logs виключно фіксований словник; ні JS source, ні файлові шляхи, ні токени, ні назви ENV, ні image layer IDs не потрапляють у GitHub.
- Всі CI тести створюють **вигадані** Docker tar layers без приватного snapshot.

Після green CI та review/merge: вручну викликати `main` → `inspect-gateway-snapshot` з порожнім `approved_sha`. Це **не** `deploy` і **не** `probe-gateway-offline`.

Навіть якщо знайдеться `filesystem_write_api_signal=present`, **не** повторювати запуск старого образу зі знятим `--read-only` автоматично. Спочатку потрібен змістовний аналіз у приватному ізольованому середовищі з точною прив'язкою до старого executable і без доступу до live ресурсів. Реліз та production rollback лишаються blocked/unverified.
