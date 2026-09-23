"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
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
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 space-y-5"
      >
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Қауіпсіз Ас</h1>
          <p className="text-sm text-slate-500">Мектеп асханасы мен СЭС арасындағы жүйе</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Логин</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Құпиясөз</label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 text-white font-semibold py-2.5 hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Кіру..." : "Кіру"}
        </button>
      </form>
    </main>
  );
}
