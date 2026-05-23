'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import socket from '@/lib/socket';
import toast from 'react-hot-toast';

interface OrderItem { id: number; name: string; quantity: number; unit_price: number; note: string; }
interface Order {
  id: number; table_number: number; table_zone: string;
  status: string; note: string; created_at: string; items: OrderItem[];
}

const STATUS: Record<string, string> = {
  pending: 'Bekliyor', preparing: 'Hazırlanıyor', ready: 'Hazır', delivered: 'Teslim Edildi'
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  preparing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ready: 'bg-green-500/20 text-green-400 border-green-500/30',
  delivered: 'bg-stone-500/20 text-stone-400 border-stone-500/30',
};

export default function WaiterPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get('/api/orders');
      setOrders(res.data);
    } catch { toast.error('Siparişler yüklenemedi'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager','waiter'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadOrders();

    socket.connect();
    socket.on('new_order', () => { loadOrders(); toast('🛎 Yeni sipariş!', { icon: '🛎' }); });
    socket.on('order_updated', () => loadOrders());
    return () => { socket.off('new_order'); socket.off('order_updated'); socket.disconnect(); };
  }, [loadOrders]);

  async function updateStatus(id: number, status: string) {
    try {
      await api.patch(`/api/orders/${id}/status`, { status });
      toast.success(STATUS[status]);
      loadOrders();
    } catch { toast.error('Hata oluştu'); }
  }

  function logout() { clearAuth(); router.replace('/login'); }

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  const pending = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'preparing');
  const ready = orders.filter(o => o.status === 'ready');

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-amber-500">Garson Ekranı</h1>
          <p className="text-stone-400 text-xs mt-0.5">{user?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-xs">
            <span className="text-rose-400 font-semibold">{pending.length} bekliyor</span>
            <span className="text-amber-400 font-semibold">{preparing.length} hazırlanıyor</span>
            <span className="text-green-400 font-semibold">{ready.length} hazır</span>
          </div>
          <button onClick={logout} className="text-stone-500 hover:text-white text-sm transition">Çıkış</button>
        </div>
      </header>

      <main className="p-6">
        {orders.length === 0 ? (
          <div className="text-center py-20 text-stone-500">
            <div className="text-5xl mb-3">✅</div>
            <div>Aktif sipariş yok</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bekleyenler */}
            <div>
              <h2 className="text-rose-400 font-semibold text-sm uppercase tracking-wider mb-3 border-b border-rose-500/20 pb-2">
                Bekliyor ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map(o => (
                  <OrderCard key={o.id} order={o} onAction={() => updateStatus(o.id, 'preparing')} actionLabel="Hazırlıyorum" actionClass="bg-amber-500 hover:bg-amber-600 text-stone-900" />
                ))}
              </div>
            </div>
            {/* Hazırlanıyor */}
            <div>
              <h2 className="text-amber-400 font-semibold text-sm uppercase tracking-wider mb-3 border-b border-amber-500/20 pb-2">
                Hazırlanıyor ({preparing.length})
              </h2>
              <div className="space-y-3">
                {preparing.map(o => (
                  <OrderCard key={o.id} order={o} onAction={() => updateStatus(o.id, 'ready')} actionLabel="Hazır" actionClass="bg-green-500 hover:bg-green-600 text-white" />
                ))}
              </div>
            </div>
            {/* Hazır */}
            <div>
              <h2 className="text-green-400 font-semibold text-sm uppercase tracking-wider mb-3 border-b border-green-500/20 pb-2">
                Hazır - Teslim Edilecek ({ready.length})
              </h2>
              <div className="space-y-3">
                {ready.map(o => (
                  <OrderCard key={o.id} order={o} onAction={() => updateStatus(o.id, 'delivered')} actionLabel="Teslim Et" actionClass="bg-blue-500 hover:bg-blue-600 text-white" />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function OrderCard({ order, onAction, actionLabel, actionClass }: {
  order: Order; onAction: () => void; actionLabel: string; actionClass: string;
}) {
  const time = new Date(order.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-bold text-amber-400">{order.table_zone} - Masa {order.table_number}</div>
          <div className="text-stone-500 text-xs">{time}</div>
        </div>
        <span className="text-xs font-medium">#{order.id}</span>
      </div>
      <div className="space-y-1 mb-3">
        {order.items?.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-stone-300">{item.quantity}x {item.name}</span>
            <span className="text-stone-500">₺{(item.quantity * item.unit_price).toFixed(2)}</span>
          </div>
        ))}
      </div>
      {order.note && <div className="text-xs text-amber-400/70 mb-3 italic">Not: {order.note}</div>}
      <button onClick={onAction} className={`w-full py-2 rounded-lg text-sm font-semibold transition ${actionClass}`}>
        {actionLabel}
      </button>
    </div>
  );
}
