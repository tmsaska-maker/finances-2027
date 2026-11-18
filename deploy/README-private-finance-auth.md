# Налаштування авторизації приватного фінансового шлюзу

Разова дія на **наявному** Lightsail, без GitHub Actions і без нової бази. Виконується у вебтерміналі AWS Lightsail (SSH), а не в GitHub і не в ChatGPT.

Після розміщення цих файлів у `main` скопіюй дві команди у термінал Lightsail:

```bash
curl -fsSLo /tmp/configure-private-finance-auth.py https://raw.githubusercontent.com/tmsaska-maker/finances-2027/main/deploy/configure-private-finance-auth.py
sudo python3 /tmp/configure-private-finance-auth.py --setup
```

Команда попросить **двічі ввести новий пароль доступу до фінансової програми**. Символи під час введення не видно — це нормально. Пароль мусить містити 16–256 символів. Пароль нікуди не передається і не записується в GitHub; у приватному файлі `/opt/finances-2027/backend/deploy/.env` зберігається тільки PBKDF2-хеш пароля. Ключ сесії згенерується локально на сервері. Існуючий токен API та пароль бази не змінюються.

Після успіху можна перевірити без показу значень:

```bash
sudo python3 /tmp/configure-private-finance-auth.py --check
rm -f /tmp/configure-private-finance-auth.py
```

Очікується `Finance gateway auth status: ready`. Якщо термінал напише, що .env не приватний, спочатку потрібне `sudo chmod 600 /opt/finances-2027/backend/deploy/.env`; якщо в файлі відсутній токен API — команда зупиниться, вона не створює новий токен і не змінює API.

**Не надсилати пароль, ключ сесії, хеш або вміст .env в чат/issue/коміти.**

Далі: один запуск наявного `manual-finance-deploy.yml`, `operation=private-ui`, із точним SHA активного `main`. `inspect-edge` не потрібен. Код не створює backup, snapshot, другу БД чи другий сайт. `--setup` тільки налаштовує авторизацію — сам сайт він не оновлює.
