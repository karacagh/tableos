'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Review {
  id: number; table_number: number; table_zone: string;
  rating_product: number; rating_ambiance: number; rating_service: number;
  avg_rating: number; note: string; created_at: string;
  bill_number: string;
  cashier_name: string;
  waiter_name: string;
  kitchen_name: string;
}
interface Stats {
  total_reviews: number; avg_product: number;
  avg_ambiance: number; avg_service: number; avg_overall: number;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <span key={s} className={`text-sm ${s <= rating ? 'text-amber-400' : 'text-stone-600'}`}>★</span>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadAll();
  }, []);

  function logout() { clearAuth(); router.replace('/login'); }

  async function loadAll(d = date) {
    setLoading(true);
    try {
      const params = d ? `?date=${d}` : '';
      const [reviewsRes, statsRes] = await Promise.all([
        api.get(`/api/reviews${params}`),
        api.get('/api/reviews/stats'),
      ]);
      setReviews(reviewsRes.data);
      setStats(statsRes.data);
    } catch { toast.error('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-stone-400 hover:text-white transition text-sm">← Geri</a>
          <h1 className="text-lg font-bold text-amber-500">Müşteri Yorumları</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date}
            onChange={e => { setDate(e.target.value); loadAll(e.target.value); }}
            className="bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
          {date && (
            <button onClick={() => { setDate(''); loadAll(''); }}
              className="text-stone-400 hover:text-white text-sm transition">Tümü</button>
          )}
          <span className="text-stone-400 text-sm">{user?.name}</span>
          <button onClick={logout}
            className="text-stone-500 hover:text-white text-sm transition border border-stone-700 hover:border-stone-500 px-3 py-1 rounded-lg">
            Çıkış
          </button>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {/* Genel İstatistikler */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Toplam Yorum', value: stats.total_reviews, suffix: '' },
              { label: 'Genel Puan', value: stats.avg_overall, suffix: '/5' },
              { label: 'Ürünler', value: stats.avg_product, suffix: '/5' },
              { label: 'Ortam', value: stats.avg_ambiance, suffix: '/5' },
              { label: 'Servis', value: stats.avg_service, suffix: '/5' },
            ].map(s => (
              <div key={s.label} className="bg-stone-800 border border-stone-700 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{s.value}{s.suffix}</div>
                <div className="text-stone-500 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Yorum Listesi */}
        {reviews.length === 0 ? (
          <div className="text-center py-16 text-stone-500">
            <div className="text-4xl mb-3">⭐</div>
            <div>Henüz yorum yok</div>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="bg-stone-800 border border-stone-700 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-amber-400">{r.table_zone} · Masa {r.table_number}</div>
                    <div className="text-stone-500 text-xs mt-0.5">
                      {new Date(r.created_at).toLocaleString('tr-TR', {day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-amber-400">{r.avg_rating}</div>
                    <Stars rating={Math.round(r.avg_rating)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: '🍽️ Ürünler', value: r.rating_product },
                    { label: '✨ Ortam', value: r.rating_ambiance },
                    { label: '👋 Servis', value: r.rating_service },
                  ].map(item => (
                    <div key={item.label} className="bg-stone-700 rounded-lg p-2 text-center">
                      <div className="text-xs text-stone-400 mb-1">{item.label}</div>
                      <Stars rating={item.value} />
                    </div>
                  ))}
                </div>
                {r.note && (
                  <div className="bg-stone-700 rounded-lg px-3 py-2 text-sm text-stone-300 italic">
                    "{r.note}"
                  </div>
                )}
                {(r.bill_number || r.cashier_name || r.waiter_name || r.kitchen_name) && (
                  <div className="mt-3 pt-3 border-t border-stone-700 grid grid-cols-2 gap-2">
                    {r.bill_number && (
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span>🧾</span>
                        <span>Fiş: <span className="text-stone-400 font-medium">{r.bill_number}</span></span>
                      </div>
                    )}
                    {r.cashier_name && (
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span>💰</span>
                        <span>Kasiyer: <span className="text-stone-400 font-medium">{r.cashier_name}</span></span>
                      </div>
                    )}
                    {r.waiter_name && (
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span>🧑‍🍽️</span>
                        <span>Garson: <span className="text-stone-400 font-medium">{r.waiter_name}</span></span>
                      </div>
                    )}
                    {r.kitchen_name && (
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span>👨‍🍳</span>
                        <span>Mutfak: <span className="text-stone-400 font-medium">{r.kitchen_name}</span></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
