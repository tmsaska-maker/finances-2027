# Development rules — Finances 2027

Read the current architecture at https://docs.google.com/document/d/1NZHujPiALISLj8S3_pD02Mf2mqiHipH4_IpleZ0dqnk/edit before implementing financial logic.
Preserve the Figma Make v0.2 design: no visual redesign without explicit approval.
Never commit real bank transactions, patient information, staff identifiers, passwords, tokens, or API keys.
Distinguish planned transactions, incurred obligations, confirmed bank movements, tax obligations and official tax crediting.
Use money in integer minor units; test duplicate prevention, cross-currency handling and partial settlements.
Treat business and personal finances as separate scopes. Owner remuneration is a managerial ledger, not employee payroll.
Use Issues and PRs with tests and verification steps. Do not preserve superseded requirements in code or documentation.
