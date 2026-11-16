# T007 — перевірка реального старого образу без перемикання

`deploy/finance-gateway-rollback-snapshot.py` призначений **лише для ручного операційного запуску** `snapshot-gateway` у захищеному GitHub Actions workflow. Це НЕ операція `deploy`.

## Що вона робить

1. На Lightsail перевіряє єдиний живий Docker Compose контейнер саме `finances2027/gateway`, який має loopback host binding 8092; відмовляється діяти при невизначеності.
2. Перевіряє точний immutable image ID запущеного контейнера та збережені приватні Compose джерела в `/opt/finances-2027`. Знімає root-only зліпок метаданих контейнера, image, Compose-файлів і приватного `.env`.
3. На диску **самого Lightsail**, у root-only `/opt/finances-2027/backups/gateway-rollback/<approved_sha>/`, виконує `docker save` старого image у tar і перевіряє Docker manifest + SHA256.
4. Створює тимчасовий контейнер зі старого immutable image ID, **ніколи його не запускаючи**. Контейнер без мережі, з read-only FS, без capabilities та host ports. Перевіряє, що Docker прийняв саме образ старого шлюзу, видаляє лише створений діагностичний контейнер.
5. У GitHub Actions logs показує тільки класифікатори `verified / unverified`, жодних image ID, IP, env, Compose, creds, паролів чи даних пацієнтів.

Розмір старого образу перевіряється до архівації, має бути достатньо дискового простору. Повторне використання того самого release SHA не перезаписує створений архів.

**Обмеження:** локальний snapshot залишається на сервері, не завантажується у GitHub і не експортований у S3. Це не off-server disaster recovery. `docker create` без `start` не перевіряє реальний старт старого сервісу, його секрети, підключення до API, TLS чи роботу Caddy. `rollback_rehearsal_passed` **не можна** встановлювати у true за цим результатом. Для повноцінного безпечного відкату потрібна окрема ізольована runtime репетиція, а не втручання у робочий 8092.

## Сфера доступу

Реально запущений finance gateway на 8092 не зупиняється, не перезапускається і не змінюється. Фінансові `api`/PostgreSQL, Caddy і Screening40 не чіпаються. На Lightsail записується тільки root-only finance rollback snapshot і тимчасова Docker metadata проба, яку видаляють одразу. Це контрольована операція з серверними записами, **не read-only діагностика**.
