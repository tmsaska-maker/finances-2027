# T007 — справжній старий gateway: isolated offline runtime probe

**Мета:** перевірити, чи точний старий Docker image, збережений у snapshot run №43952270165 (SHA `8bf0f2b0a59909bbff3a667e7c025b192123acdc`), може запуститися як процес, **без повернення/заміни live сервісу**.

## Ручна операція

`manual-finance-deploy.yml` → `probe-gateway-offline` (main, `approved_sha` порожнє). Це **не** `deploy`.

1. Звіряє SHA256 старого приватного Docker-архіву, оригінальний immutable image ID та точний image запущеного finance gateway.
2. Перевіряє один працюючий `finances2027/gateway` і один `finances2027/api`; шлюз на host `127.0.0.1:8092`.
3. Перевіряє відсутність очевидних токенів/паролів у image-ENV та оголошених image volumes. За несподіваних умов — **fail closed**, без тестового запуску.
4. Створює **лише окремий короткоживучий** Docker контейнер зі старого immutable image ID, оригінальним CMD/entrypoint, але з **вигаданими** параметрами. `--network none`, read-only FS, усі capabilities dropped, no-new-privileges, resource limits, відсутні volumes та опубліковані host ports. Не під'єднує жодну production Docker network/API/DB і не передає real env.
5. Якщо процес працює, спробує анонімний GET `/finance-api/session` **зсередини цього самого контейнера** (loopback) і класифікує лише HTTP status; не виводить body/logs/secrets. Потім видаляє **тільки пробний контейнер**.
6. Звіряє live gateway і API container IDs до/після; у логи пише лише класифіковані висновки.

### Як інтерпретувати

- `RESULT=isolated_old_image_start_verified` і `ANONYMOUS_RESPONSE=legacy_anonymous_403` означають, що образ стартував з синтетичними параметрами та анонімно відхиляє запит — **не** відновлення production-конфігурації.
- `RUNTIME_BOOT=exited_without_live_secrets` або `ANONYMOUS_RESPONSE=unavailable` — **обмеження перевірки**, не доказ пошкодження образу; програма може вимагати оригінальні production змінні, які ми навмисно не передаємо. Workflow може завершитися з failure без жодного впливу на live-сервіси.
- `PRODUCTION_ROLLBACK=unverified` залишиться незалежно від результату. Не відмічати `rollback_rehearsal_passed=true` після цього тесту.
- Snapshot містить приватні конфігурації лише на Lightsail, не передається до GitHub. Це **локальний**, не off-site backup.

**Межі:** без Caddy/Screening40/finance API/DB, live gateway 8092 залишається незмінним, ніяких реальних фінансових записів, тестових паролів/токенів не розкриваємо в логах. Успішний standalone startup не доводить функціональне повернення production шлюзу й не є дозволом на реліз.
