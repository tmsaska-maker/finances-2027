import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { loginFinance, logoutFinance, readFinanceSession } from "./domain/finance-session";

/** Only rendered for a separately built PRIVATE UI, never on public GitHub Pages. */
export default function PrivateFinanceGate({ children }: { children: (logout: () => Promise<void>) => ReactNode }) {
  const [status, setStatus] = useState<"checking" | "locked" | "unlocked">("checking");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void readFinanceSession()
      .then(ok => { if (active) setStatus(ok ? "unlocked" : "locked"); })
      .catch(() => { if (active) { setError("Немає безпечного з’єднання з фінансовим сервером."); setStatus("locked"); } });
    return () => { active = false; };
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await loginFinance(password);
      const authenticated = await readFinanceSession();
      if (!authenticated) throw Error("Сесію не підтверджено сервером");
      setPassword("");
      setStatus("unlocked");
    } catch (reason) {
      setStatus("locked");
      setError(reason instanceof Error ? reason.message : "Не вдалося увійти");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    // Hide financial records before attempting a remote logout.
    setStatus("locked");
    setPassword("");
    setError("");
    try { await logoutFinance(); }
    catch { setError("Не вдалося підтвердити вихід на сервері. Не використовуй цей браузер до завершення сесії."); }
  }

  if (status === "unlocked") return <>{children(signOut)}</>;

  return <main className="finance-auth-page">
    <section className="finance-auth-card" aria-label="Доступ до фінансів">
      <div className="finance-auth-brand">
        <span className="finance-auth-mark" aria-hidden="true">F</span>
        <span><strong>Фінанси</strong> <small>2027</small></span>
      </div>
      <div className="finance-auth-shield" aria-hidden="true">●</div>
      <h1>Приватний фінансовий кабінет</h1>
      <p>Захищений доступ до бізнесових та особистих фінансів. Дані зберігаються на сервері, не в цьому браузері.</p>
      {status === "checking" ? <p role="status">Перевіряємо захищену сесію…</p> :
        <form onSubmit={signIn}>
          <label htmlFor="finance-private-password">Пароль доступу</label>
          <input id="finance-private-password" type="password" autoComplete="current-password"
            value={password} onChange={event => setPassword(event.target.value)}
            minLength={1} maxLength={256} required disabled={busy}/>
          {error && <p role="alert" className="finance-auth-error">{error}</p>}
          <button className="primary" type="submit" disabled={busy || !password}>
            {busy ? "Перевіряємо доступ…" : "Увійти"}
          </button>
        </form>}
      <small>Лише приватне HTTPS-з’єднання. Серверний ключ API ніколи не зберігається в інтерфейсі.</small>
    </section>
  </main>;
}
