"use client";

import { useEffect, useState, use as usePromise } from "react";

type MenuItem = {
  id: string;
  name: string;
  standardPortionG: number | null;
  photoUrl: string | null;
};

export default function ParentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/p/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSchoolName(data.schoolName);
          setMenuItems(data.menuItems);
        }
        setLoading(false);
      });
  }, [token]);

  async function submitFeedback() {
    if (rating === 0) return;
    const res = await fetch(`/api/p/${token}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: comment || undefined }),
    });
    if (res.ok) setSubmitted(true);
    else {
      const data = await res.json();
      setError(data.error ?? "Қате шықты");
    }
  }

  if (loading) return <div className="p-6 text-center text-muted">Жүктелуде...</div>;
  if (error && !schoolName) return <div className="p-6 text-center text-bad-700">{error}</div>;

  return (
    <main className="min-h-screen pb-10">
      <header className="bg-surface border-b border-line px-4 py-4 text-center">
        <h1 className="text-xl font-bold text-ink">{schoolName}</h1>
        <p className="text-sm text-muted">Бүгінгі мәзір</p>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {menuItems.length === 0 && <p className="text-center text-sm text-muted">Бүгін мәзір енгізілмеген.</p>}
        {menuItems.map((item) => (
          <div key={item.id} className="card overflow-hidden">
            {item.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.photoUrl} alt={item.name} className="w-full h-40 object-cover" />
            )}
            <div className="p-3">
              <p className="font-semibold text-ink">{item.name}</p>
              {item.standardPortionG && <p className="text-xs text-muted">Порция: {item.standardPortionG} г</p>}
            </div>
          </div>
        ))}

        <div className="card p-4 space-y-3">
          <h2 className="font-bold text-ink">Тағамға баға беріңіз</h2>
          {submitted ? (
            <p className="text-primary font-medium">Рахмет! Пікіріңіз қабылданды.</p>
          ) : (
            <>
              <div className="flex gap-2 justify-center text-3xl">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} className={n <= rating ? "text-warn-500" : "text-slate-300"}>
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Пікіріңіз (міндетті емес)"
                className="field text-sm"
                rows={2}
              />
              {error && <p className="text-sm text-bad-700">{error}</p>}
              <button
                onClick={submitFeedback}
                disabled={rating === 0}
                className="btn btn-primary w-full py-2.5"
              >
                Жіберу
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
