'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
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

type FilterType = 'daily' | 'weekly' | 'monthly' | 'custom';

export default function ReportsPage() {
  const router = useRouter();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [rangeReport, setRangeReport] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadReports();
  }, []);

  function logout() { clearAuth(); router.replace('/login'); }

  async function loadReports(d?: string) {
    setLoading(true);
    try {
      const targetDate = d || date;
      const [daily, weeklyRes] = await Promise.all([
        api.get(`/api/reports/daily?date=${targetDate}`),
        api.get('/api/reports/weekly'),
      ]);
      setReport(daily.data);
      setWeekly(weeklyRes.data);
    } catch { toast.error('Rapor yüklenemedi'); }
    finally { setLoading(false); }
  }

  async function loadRangeReport(start: string, end: string) {
    setLoading(true);
    try {
      const res = await api.get(`/api/reports/range?start=${start}&end=${end}`);
      setRangeReport(res.data);
    } catch { toast.error('Rapor yüklenemedi'); }
    finally { setLoading(false); }
  }

  function handleFilterChange(type: FilterType) {
    setFilterType(type);
    const today = new Date();
    if (type === 'daily') {
      const d = today.toISOString().split('T')[0];
      setDate(d);
      loadReports(d);
    } else if (type === 'weekly') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      setCustomStart(start.toISOString().split('T')[0]);
      setCustomEnd(today.toISOString().split('T')[0]);
      loadRangeReport(start.toISOString().split('T')[0], today.toISOString().split('T')[0]);
    } else if (type === 'monthly') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setCustomStart(start.toISOString().split('T')[0]);
      setCustomEnd(end.toISOString().split('T')[0]);
      loadRangeReport(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    }
  }

  const maxRevenue = Math.max(...weekly.map(w => Number(w.revenue)), 1);

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-stone-400 hover:text-white transition text-sm">← Geri</a>
          <h1 className="text-lg font-bold text-amber-500">Raporlar</h1>
        </div>

        {/* Kullanıcı + Çıkış */}
        <div className="flex items-center gap-3">
          <span className="text-stone-400 text-sm">{user?.name}</span>
          <button onClick={logout}
            className="text-stone-500 hover:text-white text-sm transition border border-stone-700 hover:border-stone-500 px-3 py-1 rounded-lg">
            Çıkış
          </button>
        </div>

        {/* Filtre Butonları */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-stone-900 rounded-lg p-1">
            {([
              { key: 'daily', label: 'Günlük' },
              { key: 'weekly', label: 'Haftalık' },
              { key: 'monthly', label: 'Aylık' },
              { key: 'custom', label: 'Özel' },
            ] as { key: FilterType; label: string }[]).map(f => (
              <button key={f.key} onClick={() => handleFilterChange(f.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${filterType === f.key ? 'bg-amber-500 text-stone-900' : 'text-stone-400 hover:text-white'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {filterType === 'daily' && (
            <input type="date" value={date}
              onChange={e => { setDate(e.target.value); loadReports(e.target.value); }}
              className="bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
          )}

          {filterType === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              <span className="text-stone-500 text-sm">—</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              <button onClick={() => { if (customStart && customEnd) loadRangeReport(customStart, customEnd); else toast.error('Tarih aralığı seçin'); }}
                className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
                Getir
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Dönem Başlığı */}
        <div className="text-stone-400 text-sm">
          {filterType === 'daily' && `📅 ${new Date(date).toLocaleDateString('tr-TR', {day:'numeric',month:'long',year:'numeric'})}`}
          {filterType === 'weekly' && `📅 Son 7 Gün`}
          {filterType === 'monthly' && `📅 ${new Date().toLocaleDateString('tr-TR', {month:'long',year:'numeric'})}`}
          {filterType === 'custom' && customStart && customEnd && `📅 ${customStart} — ${customEnd}`}
        </div>

        {/* Günlük Rapor */}
        {filterType === 'daily' && report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Toplam Ciro" value={`₺${Number(report.bills.total_revenue).toLocaleString('tr-TR')}`} color="text-amber-400" />
              <StatCard label="Sipariş" value={report.orders.total_orders.toString()} color="text-blue-400" />
              <StatCard label="Teslim Edildi" value={report.orders.delivered.toString()} color="text-green-400" />
              <StatCard label="İptal" value={report.orders.cancelled.toString()} color="text-rose-400" />
            </div>

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

            {weekly.length > 0 && (
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
                <h2 className="text-stone-300 font-semibold mb-4">Son 7 Gün — Ciro Trendi</h2>
                <div className="flex items-end gap-2 h-32">
                  {weekly.map(w => {
                    const height = Math.max((Number(w.revenue) / maxRevenue) * 100, 4);
                    const dayLabel = new Date(w.date).toLocaleDateString('tr-TR', { weekday: 'short' });
                    const isToday = w.date === date;
                    return (
                      <div key={w.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs text-amber-400 font-semibold">
                          {Number(w.revenue) > 0 ? `₺${(Number(w.revenue)/1000).toFixed(1)}k` : ''}
                        </div>
                        <div className={`w-full rounded-t-md transition-all ${isToday ? 'bg-amber-500' : 'bg-amber-500/20 hover:bg-amber-500/40'}`}
                          style={{ height: `${height}%` }} />
                        <div className={`text-xs ${isToday ? 'text-amber-400 font-semibold' : 'text-stone-500'}`}>{dayLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TopProducts products={report.top_products} />
              <StaffPerf staff={report.staff_performance} />
            </div>
          </>
        )}

        {/* Haftalık / Aylık / Özel Rapor */}
        {(filterType !== 'daily') && rangeReport && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Toplam Ciro" value={`₺${Number(rangeReport.total_revenue || 0).toLocaleString('tr-TR')}`} color="text-amber-400" />
              <StatCard label="Sipariş" value={(rangeReport.total_orders || 0).toString()} color="text-blue-400" />
              <StatCard label="Teslim Edildi" value={(rangeReport.delivered_orders || 0).toString()} color="text-green-400" />
              <StatCard label="Günlük Ort. Ciro" value={`₺${Number(rangeReport.avg_daily_revenue || 0).toFixed(0)}`} color="text-purple-400" />
            </div>

            {rangeReport.daily_breakdown && rangeReport.daily_breakdown.length > 0 && (
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
                <h2 className="text-stone-300 font-semibold mb-4">Günlük Ciro Dağılımı</h2>
                <div className="space-y-2">
                  {rangeReport.daily_breakdown.map((d: any) => {
                    const maxRev = Math.max(...rangeReport.daily_breakdown.map((x: any) => Number(x.revenue)), 1);
                    const pct = Math.max((Number(d.revenue) / maxRev) * 100, 2);
                    return (
                      <div key={d.date} className="flex items-center gap-3">
                        <div className="text-stone-400 text-xs w-24 flex-shrink-0">
                          {new Date(d.date).toLocaleDateString('tr-TR', {day:'numeric',month:'short'})}
                        </div>
                        <div className="flex-1 bg-stone-700 rounded-full h-4 overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full transition-all" style={{width:`${pct}%`}} />
                        </div>
                        <div className="text-amber-400 text-xs font-semibold w-24 text-right">
                          ₺{Number(d.revenue).toLocaleString('tr-TR')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TopProducts products={rangeReport.top_products || []} />
              <StaffPerf staff={rangeReport.staff_performance || []} />
            </div>
          </>
        )}

        {(filterType !== 'daily') && !rangeReport && !loading && (
          <div className="text-center py-16 text-stone-500">
            <div className="text-4xl mb-3">📊</div>
            <div>Rapor için tarih aralığı seçin</div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-stone-400 text-sm mt-1">{label}</div>
    </div>
  );
}

function TopProducts({ products }: { products: any[] }) {
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
      <h2 className="text-stone-300 font-semibold mb-4">En Çok Satan Ürünler</h2>
      {products.length === 0 ? (
        <div className="text-stone-600 text-sm text-center py-6">Veri yok</div>
      ) : (
        <div className="space-y-3">
          {products.map((p, i) => (
            <div key={p.name} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">{i+1}</div>
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
  );
}

function StaffPerf({ staff }: { staff: any[] }) {
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
      <h2 className="text-stone-300 font-semibold mb-4">Garson Performansı</h2>
      {staff.length === 0 ? (
        <div className="text-stone-600 text-sm text-center py-6">Veri yok</div>
      ) : (
        <div className="space-y-3">
          {staff.map(s => (
            <div key={s.name} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-amber-400 font-bold text-xs flex-shrink-0">
                {s.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium">{s.name}</div>
                <div className="text-stone-500 text-xs">{s.total_orders} sipariş {s.avg_delivery_mins && `· Ort. ${s.avg_delivery_mins} dk`}</div>
              </div>
              <div className="text-amber-400 text-sm font-semibold">₺{Number(s.total_revenue).toLocaleString('tr-TR')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
