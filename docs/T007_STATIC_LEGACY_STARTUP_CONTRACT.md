# T007 — статичний контракт запуску старого gateway (без запуску)

## Підтверджено в репозиторії

- `server/browser-gateway-main.mjs` та `server/browser-gateway.mjs` описують **новий кандидат** gateway, а НЕ гарантовано той старий образ, який працює на Lightsail.
- Кандидат перевіряє `NODE_ENV=production`, HTTPS public origin, приватний API origin, API token (мінімум 32 символи), session secret (мінімум 48 символів) та password hash (48 hex : 64 hex). У режимі Docker при `FINANCES_GATEWAY_BIND_HOST=0.0.0.0` кандидат очікує `FINANCES_GATEWAY_API_ORIGIN=http://api:8091`.
- Анонімний GET `/finance-api/session` **у кандидата повертає HTTP 200** із `authenticated:false`, а не HTTP 403. Тому критерій 403, який використовується для *старого* gateway, **не можна переносити на кандидат**. Визначати поведінку старого образу за кодом кандидата — помилка.
- Фіктивний `deploy/gateway-rollback-legacy-fixture.mjs` повертає 403, проте це **синтетична заглушка**, не вихідний код автентичного старого образу.

## Що нам невідомо

Код автентичного snapshot image `8bf0f2b0a59909bbff3a667e7c025b192123acdc` не ідентифікований як окремий вихідний пакет у цьому репозиторії. Попередні запуски підтвердили: архів пройшов checksum; із синтетичним оточенням процес завершився `application_exit_1`; у живого контейнера є додаткові чутливі ENV-імена з класу `other_sensitive_configuration`. Ці факти **не доводять**, що саме вони спричинили завершення. Ми не маємо підстав називати конкретні ключі, замінювати їх довільними значеннями або заявляти, що старий образ може працювати без API/DB.

## Додано

`deploy/gateway-static-startup-contract.py` — **чиста функція** `classify_metadata(container,image)`, яка аналізує тільки *вже отримані* Docker inspect JSON у пам'яті:

- перевіряє відповідність immutable image ID, форму Env і структуру командних полів;
- класифікує лише присутність додаткових чутливих та мережевих ENV-категорій;
- не повертає назви/значення ENV, команди, адреси, image ID, логи, кількості або приватні метадані;
- завжди повідомляє `offline_functional_start=unverified` і `production_rollback=unverified`.

Тести `deploy/gateway-static-startup-contract.test.py` використовують **тільки вигадані metadata**, без Docker/AWS/SSH, файлів snapshot і production-сервісів. CI запускає ці тести без секретів.

## Рішення для наступного етапу

**Тільки після review та green CI:** вирішити, чи потрібне *окреме* ручне metadata-only дослідження snapshot на самому Lightsail. Перед таким етапом розробити ізольований wrapper: root-only читання приватних `running-container.json` і `running-image.json` (ніколи не копіювати в GitHub), контроль SHA256 та прав, строгий вивід тільки з allowlist, відсутність запуску Docker-контейнерів, мережі й записів. Самого wrapper наразі НЕ додано і НЕ запускали.

Незмінні блокатори: справжній rollback runbook та production runtime не перевірені; `rollback_rehearsal_passed` залишити false; фінансовий production release не дозволяти.
