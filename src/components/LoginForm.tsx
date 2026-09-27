"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

// Жылдам кіру аккаунттары (prisma/seed.ts). Құпиясөз бандлда сақталмайды: ол SEED_PASSWORD арқылы
// орнатылады және қолмен енгізіледі.
const TEST_ACCOUNTS = ["a12_kitchen", "a12_nurse", "m07_kitchen", "ses1", "edu1"];

export function LoginForm({ initialLogin }: { initialLogin?: string }) {
  const router = useRouter();
  const t = useT();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [login, setLogin] = useState(initialLogin ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(l: string, p: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: l, password: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.common.error);
        return;
      }
      router.push(data.redirectTo ?? "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function pick(account: string) {
    setLogin(account);
    setError(null);
    passwordRef.current?.focus();
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn(login, password);
        }}
        className="anim-fade-up card p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-ink">{t.login.title}</h1>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted">{t.login.login}</span>
          <input
            className="field !py-2.5"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoFocus={!initialLogin}
            autoComplete="username"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted">{t.login.password}</span>
          <input
            ref={passwordRef}
            type="password"
            className="field !py-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus={!!initialLogin}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p role="alert" className="anim-slide-in text-sm text-bad-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary w-full !py-2.5">
          {loading ? t.login.submitting : t.login.submit}
        </button>
      </form>

      <div className="anim-fade-up card p-5 space-y-3" style={{ animationDelay: "120ms" }}>
        <p className="text-sm font-medium text-ink">{t.login.quick}</p>
        <div className="grid grid-cols-2 gap-2">
          {TEST_ACCOUNTS.map((account) => (
            <button
              key={account}
              type="button"
              disabled={loading}
              onClick={() => pick(account)}
              aria-pressed={login === account}
              className="tile rounded-md border border-line px-3 py-2 text-left hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft disabled:opacity-60"
            >
              <span className="block text-sm text-ink">{t.login.accounts[account]}</span>
              <span className="block text-xs text-muted font-mono">{account}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{t.login.quickHint}</p>
      </div>
    </div>
  );
}
