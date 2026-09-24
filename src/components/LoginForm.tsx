"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_ACCOUNTS = [
  { login: "kitchen_demo", label: "Асхана" },
  { login: "nurse_demo", label: "Медбике" },
  { login: "ses1", label: "СЭС инспекторы" },
  { login: "edu1", label: "Білім басқармасы" },
  { login: "admin", label: "Демо басқару" },
];
const DEMO_PASSWORD = "demo123";

export function LoginForm({ initialLogin }: { initialLogin?: string }) {
  const router = useRouter();
  const isDemo = DEMO_ACCOUNTS.some((a) => a.login === initialLogin);
  const [login, setLogin] = useState(initialLogin ?? "");
  const [password, setPassword] = useState(isDemo ? DEMO_PASSWORD : "");
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

  return (
    <div className="w-full max-w-sm space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn(login, password);
        }}
        className="anim-fade-up bg-white rounded-lg p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-ink">Жүйеге кіру</h1>

        <label className="block space-y-1.5">
          <span className="text-sm text-slate-600">Логин</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoFocus={!initialLogin}
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-slate-600">Құпиясөз</span>
          <input
            type="password"
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="anim-slide-in text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 text-white font-semibold py-2.5 hover:bg-brand-700 transition-colors disabled:opacity-60"
        >
          {loading ? "Кіру..." : "Кіру"}
        </button>
      </form>

      <div className="anim-fade-up bg-white rounded-lg p-5 space-y-3" style={{ animationDelay: "120ms" }}>
        <p className="text-sm font-medium text-ink">Демо аккаунттар</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.login}
              type="button"
              disabled={loading}
              onClick={() => signIn(a.login, DEMO_PASSWORD)}
              className="tile rounded-md border border-slate-200 px-3 py-2 text-left hover:border-brand-500 disabled:opacity-60"
            >
              <span className="block text-sm text-ink">{a.label}</span>
              <span className="block text-xs text-slate-400">{a.login}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
