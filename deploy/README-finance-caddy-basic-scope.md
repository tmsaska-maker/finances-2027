# Виправлення входу у фінансовий кабінет

Спостереження 18.11.2026: `POST /finance-api/login` повертає `HTTP 401` з `WWW-Authenticate: Basic realm="restricted"`. Отже, зовнішній Caddy Basic auth перехоплює вхід ще до окремого finance gateway. Браузер може повторно показувати старий пароль. Пароль власниці в gateway не змінювати.

**Без GitHub Actions.** На наявному сервері Lightsail через SSH завантажити фінансовий (тільки finance-host) інструмент:

```bash
curl -fsSLo /tmp/fix-finance-caddy-basic-scope.py https://raw.githubusercontent.com/tmsaska-maker/finances-2027/main/deploy/fix-finance-caddy-basic-scope.py
python3 -m py_compile /tmp/fix-finance-caddy-basic-scope.py
sudo python3 /tmp/fix-finance-caddy-basic-scope.py --check
```

`--check` лише читає існуючий Caddyfile, вимагає один finance-host, існуючий reverse proxy 8092 та один прямий `basic_auth` без matcher, готує кандидат в тимчасовій директорії й виконує `caddy validate`. При невідомому форматі припиняє роботу, нічого не змінюючи. Не показувати вміст `/etc/caddy/Caddyfile` (містить хеші).

Якщо `--check` повернув `Finance-only Caddy candidate PASS, no server changes`, виконати:

```bash
sudo python3 /tmp/fix-finance-caddy-basic-scope.py --apply
```

Зміна тільки фінансового Caddy host: старий Basic захищає сторінки сайту, але не блокує `/finance-api/*`, для якого діє cookie-session Finance gateway. Автоматичні перевірки: неавторизований сайт залишається `401 Basic`, а `/finance-api/session` відповідає `200 {"authenticated":false}`; некоректний POST login відповідає `400` шлюзу. Якщо перевірки провалилися, активна конфігурація Caddy перезавантажується зі старого Caddyfile; диск не оновлюється. Не створює БД, backup, snapshot, сайту чи контейнера; Screening40 блоки залишаються байт-в-байт незмінними.

Після успіху оновити сторінку у браузері і ввести пароль власниці в приватному інтерфейсі. Пароль в GitHub/chat не надсилати.

Для подальших `private-ui` релізів оновлено smoke: перевіряються `401` на сторінці і `200`/ `400` на finance API.
