# T007 — безпечна класифікація формату запуску старого шлюзу

Попередній аналіз №44164805986 повернув `FINANCE_GATEWAY_ENTRYPOINT_STARTUP_LOCATOR=unsupported_command`. Це **не** проблема старого шлюзу; наша вузька перевірка підтримувала тільки прямий `node script.js`. Ми не маємо підстав вгадувати шлях чи підставляти реальні налаштування.

## Нові поля статичної перевірки

Під час існуючої операції `inspect-gateway-snapshot`, **після** root-only перевірки SHA256 та ID образу, із збереженої `running-container.json` формується тільки фіксована класифікація:

- `FINANCE_GATEWAY_COMMAND_COMMAND_SHAPE`: `direct_node`, `node_with_options`, `shell`, `init_wrapper`, `env_wrapper`, `package_runner`, `other_executable`, `empty`, `metadata_invalid`;
- `FINANCE_GATEWAY_COMMAND_SCRIPT_LOCATOR`: `simple_node_script`, `node_options_or_eval`, `wrapper_requires_review`, `non_node`, `unavailable`;
- `FINANCE_GATEWAY_COMMAND_LAUNCH_ARGUMENT_SOURCE`: `entrypoint_only`, `cmd_only`, `entrypoint_and_cmd`, `none`, `unavailable`.

**Жодні аргументи команди, назви файлів, шляхи, ENV, секрети або приватні метадані не виводяться.** Важлива межа: це аналіз *синтаксису збереженої команди*, не доказ того, що саме так процес виконується під час запуску. Для wrapper / shell / Node із прапорцями автоматично визначати стартовий JavaScript-файл заборонено.

## Безпека та обмеження

- Лише існуючий `inspect-gateway-snapshot` у GitHub Actions. Модуль — чисті функції, не має Docker, мережі, файлових операцій, subprocess чи логування.
- Тести створені виключно на штучних метаданих, у них перевіряється відсутність тексту секретів у результаті та fail-closed на некоректних типах.
- Production, БД, Caddy та Screening40 не змінюються. Не запускати `probe-gateway-offline`, `deploy` або інші операції.
- Будь-який результат залишає `production_rollback=unverified`, release blocked.

Після green CI та merge: вручну `main` → `inspect-gateway-snapshot` → `approved_sha` порожній. За новим класом вирішимо, чи можна безпечно підтримати конкретний тип wrapper у наступному статичному аналізі.
