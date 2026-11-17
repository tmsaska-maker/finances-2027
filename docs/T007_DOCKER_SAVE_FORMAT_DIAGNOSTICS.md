# T007 — Docker-save archive diagnostics (без запуску образу)

## Мета

Після статичного запуску №44161403300 ми одержали `source_coverage=unsupported`. Це **не доказ** пошкодження збереженого архіву: SHA256 було підтверджено. Старий сканер вимагав, щоб кожен шлях шару в `manifest.json` завершувався виключно на `/layer.tar`, хоча формат Docker-save може використовувати інші імена, вказані в самому маніфесті.

## Зміна

Сканер `deploy/gateway-image-source-signals.py` тепер використовує список `Layers` із перевіреного `manifest.json`, а не жорстко заданий суфікс. Перевіряє безпечні відносні шляхи, унікальність посилань, звичайні TAR-файли, ліміти розмірів та кількості файлів. Нічого не розпаковує на диск, не запускає Docker, не читає конфігурацію live-сервісів.

До безпечного allowlist результатів додані три класи:
- `ARCHIVE_STRUCTURE`: `docker_save_manifest` / `manifest_missing` / `manifest_invalid` / `archive_unreadable`;
- `LAYER_REFERENCE`: `accepted` / `rejected` / `unavailable`;
- `LAYER_PARSE`: `readable` / `unreadable` / `unavailable`.

Вони доповнюють старі `SOURCE_COVERAGE`, `NODE_ENV_READ_SIGNAL`, `FILESYSTEM_WRITE_API_SIGNAL`. Жодний результат не містить назв файлів, ENV, image ID, фрагментів JavaScript або приватних шляхів. `unsupported` тепер супроводжується broad failure class. Ці класи не доводять, що функціональний запуск можливий.

## Безпека й наступна перевірка

Тестові архіви — тільки синтетичні, включно з digest-style назвами шарів, пошкодженими TAR та небезпечними шляхами. До merge — жодного ручного запуску. Після green CI/review/merge можна повторити **тільки** `inspect-gateway-snapshot`, branch `main`, порожній `approved_sha`. Не обирати `deploy` чи `probe-gateway-offline`. Реліз та production rollback лишаються заблокованими.
