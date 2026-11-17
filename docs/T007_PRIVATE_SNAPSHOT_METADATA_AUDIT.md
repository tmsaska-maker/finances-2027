# T007 — приватна статична перевірка snapshot старого шлюзу

## Призначення

Окрема ручна операція `inspect-gateway-snapshot` у `.github/workflows/manual-finance-deploy.yml` перевіряє приватний, незмінний snapshot старого gateway `8bf0f2b0a59909bbff3a667e7c025b192123acdc`. Вона **не запускає Docker**, не створює контейнери, не змінює шлюз, API чи базу даних. Підключення SSH потрібне тільки для запуску Python-аналізатора на Lightsail; до журналів GitHub надходять лише результати з фіксованого словника.

## Контроль безпеки

- Виконання тільки вручну на `main`; операція **не є** `deploy`, `snapshot-gateway` або `probe-gateway-offline`.
- Аналізатор вимагає root та точний SHA snapshot; root-only directory / files, заборона symlinks, ліміти розміру JSON.
- Локально звіряє SHA256 приватного `original-gateway-image.tar` з `archive.sha256`, а також immutable image ID у `image.sha256`, `running-container.json` та `running-image.json`.
- Порівнює тільки метадані `Entrypoint`, `Cmd`, класи додаткових ENV. Весь сирий JSON, значення і навіть назви секретів залишаються в пам'яті процесу на Lightsail.
- Перед виводом перевіряє **точний набір дозволених ключів та значень**; при відхиленні — fail closed.
- Не читає Docker live state або журнали, не пише до snapshot і не переносить snapshot у GitHub.
- Не знімає блокування `rollback_rehearsal_passed`. Не доводить працездатність образу чи можливість відкату.

### Виконання після CI та перегляду

GitHub Actions → `Manual finance T011 deploy (Lightsail)` → `Run workflow`, branch `main`, `operation=inspect-gateway-snapshot`, `approved_sha` порожнє. Проводити лише після дозволеного merge цього PR. `deploy` **не обирати**.

### Результат

У логах тільки `FINANCE_GATEWAY_STATIC_*=...` із фіксованими значеннями. `LIVE_SERVICES=not_accessed` означає відсутність прямих звернень до контейнерів, **не** перевірку стану поточних сервісів. `PRODUCTION_ROLLBACK=unverified` завжди. У разі помилки команда завершується з `RESULT=blocked` і коротким дозволеним кодом, без винятків або приватного stdout/stderr.

Обмеження: не аналізує вихідні файли всередині старого образу і не визначає з певністю причину `application_exit_1`. Це етап документування умов перед розробкою безпечної функціональної репетиції.
