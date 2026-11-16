# T007 — план релізу нового приватного фінансового шлюзу (без виконання)

**Версія підготовки:** 16.11.2026. **Статус:** BLOCKED до виконання production умов і явного схвалення власницею. Жодної автоматичної дії з цього документа.

## Уже доведено

- Синтетичний Docker E2E: login, session, read-only category/obligation GET, cross-origin denial, logout — пройшов у CI (PR #36).
- Живий фінансовий gateway: Compose project `finances2027` / service `gateway`, один контейнер на host loopback 8092.
- API: один фінансовий контейнер `api`, host loopback 8091, спільна внутрішня Docker network та alias `api`.
- Старий gateway: Compose source exists, image cached; автоматичний restart policy. Це **лише передумови відкату**, не перевірений rollback.
- Поточний gateway повертає 403 на анонімний `/finance-api/session`; код нового кандидата повертає 200 `authenticated:false`.

## Етап 1 — переддеплойні ворота (усі обов'язкові)

1. Підтвердити **окремий приватний HTTPS origin** для реальних фінансів. Публічний демо-сайт і GitHub Pages не мають отримати жодних реальних даних, credential чи приватної збірки.
2. Пройти незалежний перегляд browser session security: Origin/CSRF, cookie `Secure; HttpOnly; SameSite=Strict`, 401/403, rate limiting за справжнім клієнтським IP під довіреним proxy, logout, restart/revocation, fail-closed error handling. Тести CI наразі не замінюють цього review.
3. На сервері в приватній root-only директорії зберегти exact Compose file set, конфігураційні права та точний старий Docker image digest; НЕ виводити / не завантажувати секрети до GitHub Actions або артефактів. Розробити й **окремо відрепетирувати відкат** до попередньої версії без видалення даних та без впливу на Screening40.
4. Перевірити, що новий candidate image відповідає протестованому SHA/контрольній сумі, а `gateway→api:8091` працює у production private network. Не публікувати API або gateway на `0.0.0.0` хоста.
5. Зафіксувати план фінансового Caddy route, TLS, private UI, observability без PII/секретів. Не змінювати спільні маршрути Скринінгу без незалежної перевірки.
6. Виконати контрольний authenticated браузерний smoke на закритому приватному середовищі; перевірити 401 без cookie, 200 після входу, категорії/зобов'язання, logout, 401 після виходу та session 200/false в анонімному режимі.
7. Отримати **окреме явне схвалення на виконання production перемикання** після перевірки всіх воріт.

## Етап 2 — порядок майбутнього контрольованого перемикання (НЕ автоматизовано)

- Freeze конфігурації `finances2027/gateway` і зберегти rollback point та контрольну суму в приватному сховищі. Захистити старий Docker image від втрати.
- Перевірити ізольований candidate на *іншому* loopback port без конфлікту з live 8092. Не переключати Caddy завчасно.
- Верифікувати, що Compose override застосовується **виключно** до фінансового gateway (не db, не api, не Screening40), зберігає finance private network і host loopback binding. Жодного `docker compose down`.
- За окремим approval зробити контрольоване перемикання тільки фінансового gateway із готовою командою відкату. Обмежити період впливу; здійснити приватний browser smoke і smoke із забороненим доступом.
- Якщо smoke не пройшов, негайно застосувати перевірений старий Compose/image; знову перевірити стан фінансового шлюзу та Скринінгу; залишити дані/DB незмінними.
- Лише після підтвердження production security review розглядати публікацію окремого **приватного** UI. Зовнішній public demo не змінюється.

## Формальний decision gate

`deploy/gateway-release-gate.mjs` містить 12 незалежних умов. Він **fail-closed** і не має жодного доступу до Docker/AWS/мережі. Проходження всіх умов дає лише статус «можна розглядати контрольований деплой»; сам деплой не запускається. Не підставляти синтетичні `true` як production evidence.

**Поточні блокери:** приватний origin не погоджено і не перевірено; security review/proxy rate limiting не завершено; exact old image/config rollback не збережений і не відрепетируваний; кандидат не запускався на реальній фінансовій мережі; authenticated private browser smoke не виконано; схвалення production перемикання не надане.

**ВАЖЛИВО:** workflow `manual-finance-deploy.yml` з операцією `deploy` розгортає **API та SQL міграції**, а не browser gateway. Не використовувати його для цього релізу.
