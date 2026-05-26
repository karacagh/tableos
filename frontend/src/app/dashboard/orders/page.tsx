'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface OrderItem { id: number; name: string; quantity: number; unit_price: number; note: string; }
interface Order {
  id: number; table_number: number; table_zone: string; table_id: number;
  status: string; note: string; created_at: string; delivered_at: string;
  waiter_name: string; kitchen_name: string; items: OrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor', preparing: 'Hazırlanıyor',
  ready: 'Hazır', delivered: 'Teslim Edildi', cancelled: 'İptal'
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-rose-500/20 text-rose-400',
  preparing: 'bg-amber-500/20 text-amber-400',
  ready: 'bg-green-500/20 text-green-400',
  delivered: 'bg-stone-500/20 text-stone-400',
  cancelled: 'bg-red-900/20 text-red-400',
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadOrders();
  }, []);

  function logout() { clearAuth(); router.replace('/login'); }

  async function loadOrders(d = date, s = statusFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (d) params.append('date', d);
      if (s) params.append('status', s);
      const res = await api.get(`/api/orders?${params}`);
      setOrders(res.data);
    } catch { toast.error('Siparişler yüklenemedi'); }
    finally { setLoading(false); }
  }

  async function cancelOrder(id: number) {
    if (!confirm('Bu siparişi iptal etmek istiyor musunuz?')) return;
    try {
      await api.patch(`/api/orders/${id}/status`, { status: 'cancelled' });
      toast.success('Sipariş iptal edildi');
      loadOrders();
    } catch { toast.error('Hata'); }
  }

  const totalRevenue = orders
    .filter(o => o.status === 'delivered')
    .reduce((s, o) => s + (o.items?.reduce((ss, i) => ss + (i.quantity * i.unit_price), 0) || 0), 0);

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-stone-400 hover:text-white transition text-sm">← Geri</a>
          <h1 className="text-lg font-bold text-amber-500">Sipariş Yönetimi</h1>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date}
            onChange={e => { setDate(e.target.value); loadOrders(e.target.value, statusFilter); }}
            className="bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
          <select value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); loadOrders(date, e.target.value); }}
            className="bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">Tüm Durumlar</option>
            <option value="pending">Bekliyor</option>
            <option value="preparing">Hazırlanıyor</option>
            <option value="ready">Hazır</option>
            <option value="delivered">Teslim Edildi</option>
            <option value="cancelled">İptal</option>
          </select>
          <button onClick={() => loadOrders()}
            className="bg-stone-700 hover:bg-stone-600 px-3 py-2 rounded-lg text-sm transition">
            Yenile
          </button>
          <span className="text-stone-400 text-sm">{user?.name}</span>
          <button onClick={logout}
            className="text-stone-500 hover:text-white text-sm transition border border-stone-700 hover:border-stone-500 px-3 py-1 rounded-lg">
            Çıkış
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {/* Özet */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Toplam', value: orders.length, color: 'text-white' },
            { label: 'Bekliyor', value: orders.filter(o => o.status === 'pending').length, color: 'text-rose-400' },
            { label: 'Hazırlanıyor', value: orders.filter(o => o.status === 'preparing').length, color: 'text-amber-400' },
            { label: 'Teslim Edildi', value: orders.filter(o => o.status === 'delivered').length, color: 'text-green-400' },
            { label: 'Ciro', value: `₺${totalRevenue.toFixed(2)}`, color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-stone-800 border border-stone-700 rounded-xl p-4 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-stone-500 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Sipariş Listesi */}
        {loading ? (
          <div className="text-center py-12 text-stone-500">Yükleniyor...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-stone-500">
            <div className="text-4xl mb-3">📋</div>
            <div>Bu tarihte sipariş bulunamadı</div>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(o => {
              const total = o.items?.reduce((s, i) => s + (i.quantity * i.unit_price), 0) || 0;
              const time = new Date(o.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
              const isExpanded = expandedId === o.id;
              return (
                <div key={o.id} className="bg-stone-800 border border-stone-700 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-stone-750 transition"
                    onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                    <div className="text-stone-500 text-xs w-8">#{o.id}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-amber-400">
                        {o.table_zone} · Masa {o.table_number}
                      </div>
                      <div className="text-stone-500 text-xs mt-0.5 flex gap-3">
                        <span>{time}</span>
                        {o.waiter_name && <span>Garson: {o.waiter_name}</span>}
                        {o.kitchen_name && <span>Mutfak: {o.kitchen_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                      <div className="text-amber-400 font-semibold">₺{total.toFixed(2)}</div>
                      <div className="text-stone-500 text-xs">{isExpanded ? '▲' : '▼'}</div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-4 border-t border-stone-700 pt-3">
                      <div className="space-y-2 mb-3">
                        {o.items?.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-stone-300">{item.quantity}x {item.name}</span>
                            {item.note && <span className="text-amber-400/60 text-xs italic">{item.note}</span>}
                            <span className="text-stone-400">₺{(item.quantity * item.unit_price).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {o.note && (
                        <div className="text-xs text-amber-400/70 italic mb-3">Not: {o.note}</div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-stone-700">
                        <div className="text-stone-500 text-xs">
                          {o.delivered_at && `Teslim: ${new Date(o.delivered_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}`}
                        </div>
                        {!['delivered','cancelled'].includes(o.status) && (
                          <button onClick={() => cancelOrder(o.id)}
                            className="text-rose-400 hover:text-rose-300 text-xs transition">
                            Siparişi İptal Et
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
