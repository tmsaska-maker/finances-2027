# Finance gateway — staged rollout plan (NOT deployed)

This change prepares an isolated same-origin proxy for the **test-only** `/finance-api` frontend adapter.
It does NOT enable production financial data.

## Request flow
Browser -> HTTPS finances.screening40.com.ua -> existing Caddy `basic_auth` ->
Caddy injects independent `X-Finances-Gateway-Key` from its private service environment ->
finance gateway bound on HOST **127.0.0.1:8092** ->
gateway checks key, route allowlist, request Origin for POST, JSON and size ->
gateway injects `FINANCES_API_TOKEN` in the server-side request ->
private finance API service `api:8091` -> finance PostgreSQL.

The browser never receives the API token or gateway key. The gateway does not forward
browser Authorization headers. No finance service is publicly published in Docker.

## Preconditions (do not skip)
- Keep existing Screening Caddy block and all Screening containers untouched.
- Snapshot/backup, verify free RAM/disk and rollback before changing live services.
- Run passing CI including gateway tests and PostgreSQL integration tests.
- Test finance backup/restore drill and document the actual outcome.
- The existing Caddy Basic Auth is an access gate, **not** per-user finance authorization
  or an audit trail. Use fabricated test data only.
- A separate **independent** random `FINANCES_GATEWAY_KEY` >= 32 chars is needed,
  NOT the API token and NOT the Basic Auth password/hash.
- Store `FINANCES_GATEWAY_KEY` in private `deploy/.env` alongside the existing
  `FINANCES_API_TOKEN`, and provision the exact same gateway key into Caddy's private
  systemd environment (e.g. a root-controlled EnvironmentFile), without publishing it
  to Git, HTML or chat. Review Caddy systemd service configuration before proceeding.
- Caddy's environment must actually contain `FINANCES_GATEWAY_KEY` when Caddy parses
  the Caddyfile. Verify with a safe validation, **without printing secrets**.

## Example finance-only Caddy block (do not paste over live file blindly)
Keep the existing Basic Auth username and **existing password hash** unchanged.

```caddyfile
finances.screening40.com.ua {
    basic_auth {
        admin YOUR_EXISTING_HASH
    }
    handle_path /finance-api/* {
        reverse_proxy 127.0.0.1:8092 {
            header_up X-Finances-Gateway-Key {$FINANCES_GATEWAY_KEY}
            header_up -Authorization
        }
    }
    handle {
        root * /opt/finances-2027/site
        try_files {path} /index.html
        file_server
    }
}
```

Before applying: `caddy validate --config /etc/caddy/Caddyfile` with the correct
service environment, make a dated Caddyfile backup, and only `systemctl reload caddy`
after independent tests and gateway health checks. Do not alter the Screening block.
Note Caddy command-line validation from a shell may not inherit the systemd
environment variables; inspect service configuration and test accordingly.

## Test gates
1. Unit: `node --test gateway/gateway.test.mjs`
2. Compose isolation: `node --test deploy/compose.test.mjs`
3. CI: domain tests, TypeScript, backend tests, PostgreSQL integration, Compose syntax.
4. Gateway without private header -> 403 even via host loopback.
5. Valid header /health -> 200, invalid header /health -> 403.
6. POST from wrong/missing Origin -> 403; valid same-origin JSON POST -> 201.
7. Browser receives no `FINANCES_API_TOKEN` nor `FINANCES_GATEWAY_KEY`.
8. Confirm Caddy Basic Auth protects `/finance-api` too, including POST.
9. Verify only finance containers/volumes changed; Screening remains healthy.
10. Verify Caddy and gateway rollback path (Caddyfile backup + finance-only Compose
    stop gateway), with no `docker compose down -v`.

Do NOT invoke direct browser-to-8091 or expose the bearer token in frontend.
