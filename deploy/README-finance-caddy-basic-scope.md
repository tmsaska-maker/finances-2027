# Один пароль для «Фінанси 2027»

18.11.2026: підтверджено, що `POST /finance-api/login` отримував зовнішній `401 WWW-Authenticate: Basic realm="restricted"` від Caddy. Додатково `handle_path /finance-api/*` обрізав шлях, тоді як фінансовий gateway очікує повний `/finance-api/login`.

**Погоджене спрощення:** залишаємо тільки пароль власниці у приватному кабінеті, без зовнішнього Caddy Basic для фінансового сайту. Початкова сторінка входу доступна публічно, але фінансові записи, прогноз і всі захищені API-маршрути вимагають cookie-session авторизацію шлюзу. Токен API залишається на сервері. Жодних змін у Screening40, фінансовій БД або docker-сервісах.

Через SSH на існуючому Lightsail:

```bash
curl -fsSLo /tmp/fix-finance-caddy-basic-scope.py https://raw.githubusercontent.com/tmsaska-maker/finances-2027/main/deploy/fix-finance-caddy-basic-scope.py
python3 -m py_compile /tmp/fix-finance-caddy-basic-scope.py
sudo python3 /tmp/fix-finance-caddy-basic-scope.py --check && sudo python3 /tmp/fix-finance-caddy-basic-scope.py --apply
```

`--check` лише валідовує кандидат Caddy. `--apply` змінює **тільки фінансовий блок**: прибирає `basic_auth` і замінює `handle_path /finance-api/*` на `handle /finance-api/*`, лишаючи повний шлях до шлюзу 8092. Перед збереженням перевіряє: сторінка `200`, session `200 {"authenticated":false}`, анонімний доступ до записів `401` від шлюзу, некоректний login POST `400`. Якщо перевірки не проходять, намагається перезавантажити початкову конфігурацію й не записує кандидат. Не друкує конфігурацію або секрети.

Очікуване завершення: `FINANCE_SINGLE_PASSWORD_APPLIED: finance host only; other sites unchanged`. Після цього просто оновити браузер та ввести **раніше створений** пароль приватного кабінету. GitHub Actions, новий SHA чи повторний деплой не потрібні.
