'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface DailyReport {
  date: string;
  orders: { total_orders: number; delivered: number; cancelled: number; active: number; };
  bills: {
    total_bills: number; total_revenue: number;
    cash_count: number; cash_revenue: number;
    card_count: number; card_revenue: number;
    meal_count: number; meal_revenue: number;
  };
  top_products: { name: string; total_quantity: number; total_revenue: number; }[];
  staff_performance: { name: string; total_orders: number; total_revenue: number; avg_delivery_mins: number; }[];
}
interface WeeklyData { date: string; revenue: number; bill_count: number; order_count: number; }

export default function ReportsPage() {
  const router = useRouter();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    loadReports(date);
  }, []);

  async function loadReports(d: string) {
    setLoading(true);
    try {
      const [daily, weeklyRes] = await Promise.all([
        api.get(`/api/reports/daily?date=${d}`),
        api.get('/api/reports/weekly'),
      ]);
      setReport(daily.data);
      setWeekly(weeklyRes.data);
    } catch { toast.error('Rapor yüklenemedi'); }
    finally { setLoading(false); }
  }

  const maxRevenue = Math.max(...weekly.map(w => Number(w.revenue)), 1);

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
          <h1 className="text-lg font-bold text-amber-500">Raporlar</h1>
        </div>
        <input type="date" value={date}
          onChange={e => { setDate(e.target.value); loadReports(e.target.value); }}
          className="bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
      </header>

      <main className="p-6 space-y-6 max-w-5xl mx-auto">
        {report && (
          <>
            {/* Özet Kartlar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Toplam Ciro" value={`₺${Number(report.bills.total_revenue).toLocaleString('tr-TR')}`} color="text-amber-400" />
              <StatCard label="Sipariş Sayısı" value={report.orders.total_orders.toString()} color="text-blue-400" />
              <StatCard label="Teslim Edilen" value={report.orders.delivered.toString()} color="text-green-400" />
              <StatCard label="İptal Edilen" value={report.orders.cancelled.toString()} color="text-rose-400" />
            </div>

            {/* Ödeme Dağılımı */}
            <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
              <h2 className="text-stone-300 font-semibold mb-4">Ödeme Dağılımı</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Nakit', count: report.bills.cash_count, revenue: report.bills.cash_revenue, color: 'text-green-400' },
                  { label: 'Kredi Kartı', count: report.bills.card_count, revenue: report.bills.card_revenue, color: 'text-blue-400' },
                  { label: 'Yemek Kartı', count: report.bills.meal_count, revenue: report.bills.meal_revenue, color: 'text-purple-400' },
                ].map(p => (
                  <div key={p.label} className="text-center">
                    <div className={`text-2xl font-bold ${p.color}`}>₺{Number(p.revenue).toLocaleString('tr-TR')}</div>
                    <div className="text-stone-400 text-sm">{p.label}</div>
                    <div className="text-stone-600 text-xs">{p.count} işlem</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Haftalık Trend */}
            {weekly.length > 0 && (
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
                <h2 className="text-stone-300 font-semibold mb-4">Son 7 Gün — Ciro Trendi</h2>
                <div className="flex items-end gap-2 h-32">
                  {weekly.map(w => {
                    const height = Math.max((Number(w.revenue) / maxRevenue) * 100, 4);
                    const d = new Date(w.date);
                    const dayLabel = d.toLocaleDateString('tr-TR', { weekday: 'short' });
                    return (
                      <div key={w.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs text-amber-400 font-semibold">
                          {Number(w.revenue) > 0 ? `₺${(Number(w.revenue)/1000).toFixed(1)}k` : ''}
                        </div>
                        <div className="w-full bg-amber-500/20 rounded-t-md transition-all hover:bg-amber-500/40"
                          style={{ height: `${height}%` }} />
                        <div className="text-xs text-stone-500">{dayLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* En Çok Satan */}
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
                <h2 className="text-stone-300 font-semibold mb-4">En Çok Satan Ürünler</h2>
                {report.top_products.length === 0 ? (
                  <div className="text-stone-600 text-sm text-center py-6">Veri yok</div>
                ) : (
                  <div className="space-y-3">
                    {report.top_products.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{p.name}</div>
                          <div className="text-stone-500 text-xs">{p.total_quantity} adet</div>
                        </div>
                        <div className="text-amber-400 text-sm font-semibold">₺{Number(p.total_revenue).toLocaleString('tr-TR')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Garson Performansı */}
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
                <h2 className="text-stone-300 font-semibold mb-4">Garson Performansı</h2>
                {report.staff_performance.length === 0 ? (
                  <div className="text-stone-600 text-sm text-center py-6">Veri yok</div>
                ) : (
                  <div className="space-y-3">
                    {report.staff_performance.map(s => (
                      <div key={s.name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-amber-400 font-bold text-xs flex-shrink-0">
                          {s.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="text-white text-sm font-medium">{s.name}</div>
                          <div className="text-stone-500 text-xs">
                            {s.total_orders} sipariş
                            {s.avg_delivery_mins && ` · Ort. ${s.avg_delivery_mins} dk`}
                          </div>
                        </div>
                        <div className="text-amber-400 text-sm font-semibold">₺{Number(s.total_revenue).toLocaleString('tr-TR')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string; }) {
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-stone-400 text-sm mt-1">{label}</div>
    </div>
  );
}
