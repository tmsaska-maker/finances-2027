# T007 — ізольований Docker end-to-end шлюзу, **лише CI**

У PR додається тестовий контур на GitHub-hosted runner, не на Lightsail:

```text
test client → private Docker network → gateway:8092 → api:8091 (synthetic fixture)
```

- Приватна мережа створюється `docker network create --internal` і після завершення знищується разом із контейнерами; немає жодних host-published ports чи persistent volumes.
- Тестовий API використовує тільки синтетичні категорії й зобов'язання; немає PostgreSQL чи реальних даних.
- Новий gateway пропускає лише суворо визначені HTTP API origins: localhost/127.0.0.1 для локального процесу та **api:8091** у Docker для внутрішнього фінансового сервісу, відхиляючи сторонні hosts, url paths, credentials, query, fragment.
- Кандидат для Docker слухає всередині контейнера `0.0.0.0:8092` **виключно** коли upstream налаштовано на `http://api:8091`. Це НЕ означає можливість опублікувати цей порт назовні на Lightsail.
- Smoke тестує відмову без сесії, неправильний пароль, Origin, login, Secure/HttpOnly/SameSite cookie, перевірку сесії, два read-only endpoints, заборону запису, logout і повторну відмову.
- GitHub Actions для образу: лише ручний запуск з main; build і smoke на runner без AWS, SSH, Caddy чи доступу до Lightsail. На завершення — лише артефакт образу.

## Блокери перед production

**Ці тести не доводять готовність до production.** Потрібно: окремо інвентаризувати на Lightsail фактичний finance-only Compose gateway/API конфіг та мережеві обмеження; зберегти старий gateway image/конфіг і верифікувати rollback; ізольований приватний HTTPS origin і безпечний Caddy route; додаткові rate limiting/restart/sessions/CSRF перевірки; реальний end-to-end browser smoke без розкриття даних; ручне схвалення перемикання.

Поточний `finances2027/gateway` на 8092 **не змінюється**, Screening40 не чіпати, секретів у repo і CI немає.
