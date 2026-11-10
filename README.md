# Фінанси 2027

Публічний демоінтерфейс **без реальних фінансових даних**. Дизайн Figma v0.2 зберігається без змін.

## Розгортання на спільному AWS Lightsail

* Розгорнути **окремо від Скринінгу** на `127.0.0.1:8082`.
* Caddy проксуватиме `finances.screening40.com.ua` → `127.0.0.1:8082`.
* Код UI відновлюється з `finances2027-figma-ui.zip` під час GitHub Actions збірки.
* Build-архів доступний як GitHub Actions artifact `finances2027-dist`; **не запускати npm build на сервері з 1.9 GiB RAM**.
* Прямий запис секретів та реальних платежів у публічний репозиторій заборонений.

Збірка: [Actions](https://github.com/tmsaska-maker/finances-2027/actions/workflows/pages.yml).

Поточний стан: підготовка перегляду макета, не production-фінанси.
