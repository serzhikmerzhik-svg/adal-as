"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Сынақ аккаунттары (prisma/seed.ts). Құпиясөз бандлда сақталмайды: ол SEED_PASSWORD арқылы
// орнатылады және қолмен енгізіледі.
const TEST_ACCOUNTS = [
  { login: "a12_kitchen", label: "А-12 асханасы" },
  { login: "a12_nurse", label: "А-12 медбикесі" },
  { login: "m07_kitchen", label: "М-07 мейрамханасы" },
  { login: "ses1", label: "СЭС инспекторы" },
  { login: "edu1", label: "Білім бөлімі" },
  { login: "admin", label: "Оқу-жаттығу режимі" },
];

export function LoginForm({ initialLogin }: { initialLogin?: string }) {
  const router = useRouter();
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
        setError(data.error ?? "Қате шықты");
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
        <h1 className="text-xl font-semibold text-ink">Жүйеге кіру</h1>

        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Логин</span>
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
          <span className="text-sm text-muted">Құпиясөз</span>
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

        {error && <p className="anim-slide-in text-sm text-bad-600">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-primary w-full !py-2.5">
          {loading ? "Кіру..." : "Кіру"}
        </button>
      </form>

      <div className="anim-fade-up card p-5 space-y-3" style={{ animationDelay: "120ms" }}>
        <p className="text-sm font-medium text-ink">Сынақ аккаунттары</p>
        <div className="grid grid-cols-2 gap-2">
          {TEST_ACCOUNTS.map((a) => (
            <button
              key={a.login}
              type="button"
              disabled={loading}
              onClick={() => pick(a.login)}
              aria-pressed={login === a.login}
              className="tile rounded-md border border-line px-3 py-2 text-left hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft disabled:opacity-60"
            >
              <span className="block text-sm text-ink">{a.label}</span>
              <span className="block text-xs text-muted font-mono">{a.login}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Аккаунтты таңдап, құпиясөзді енгізіңіз. Құпиясөзді жоба командасы береді.</p>
      </div>
    </div>
  );
}
