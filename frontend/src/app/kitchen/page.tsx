'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import socket from '@/lib/socket';
import toast from 'react-hot-toast';

interface OrderItem { id: number; name: string; quantity: number; note: string; }
interface Order {
  id: number; table_number: number; table_zone: string;
  status: string; note: string; created_at: string; items: OrderItem[];
}

export default function KitchenPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get('/api/orders');
      setOrders(res.data.filter((o: Order) => ['pending','preparing'].includes(o.status)));
    } catch { toast.error('Siparişler yüklenemedi'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager','kitchen'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadOrders();

    socket.connect();
    socket.on('new_order', () => { loadOrders(); toast('🔔 Yeni sipariş!'); });
    socket.on('order_updated', () => loadOrders());
    return () => { socket.off('new_order'); socket.off('order_updated'); socket.disconnect(); };
  }, [loadOrders]);

  async function markReady(id: number) {
    try {
      await api.patch(`/api/orders/${id}/status`, { status: 'ready' });
      toast.success('Sipariş hazır olarak işaretlendi');
      loadOrders();
    } catch { toast.error('Hata oluştu'); }
  }

  function logout() { clearAuth(); router.replace('/login'); }

  if (loading) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <header className="bg-stone-900 border-b border-stone-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-orange-400">Mutfak Ekranı</h1>
          <p className="text-stone-500 text-xs mt-0.5">{user?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-orange-400 font-bold">{orders.length} aktif sipariş</span>
          <button onClick={logout} className="text-stone-500 hover:text-white text-sm transition">Çıkış</button>
        </div>
      </header>

      <main className="p-6">
        {orders.length === 0 ? (
          <div className="text-center py-20 text-stone-600">
            <div className="text-5xl mb-3">👨‍🍳</div>
            <div>Hazırlanacak sipariş yok</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map(o => {
              const time = new Date(o.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
              const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
              return (
                <div key={o.id} className={`border rounded-xl p-5 ${mins > 10 ? 'border-rose-500/50 bg-rose-950/20' : 'border-stone-700 bg-stone-900'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-xl font-bold text-orange-400">{o.table_zone} - Masa {o.table_number}</div>
                      <div className="text-stone-500 text-sm">{time} · {mins} dk önce</div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-full ${o.status === 'pending' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {o.status === 'pending' ? 'YENİ' : 'HAZIRLANIYOR'}
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {o.items?.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-orange-400 font-bold text-sm flex-shrink-0">
                          {item.quantity}
                        </div>
                        <div>
                          <div className="text-white font-medium">{item.name}</div>
                          {item.note && <div className="text-amber-400/70 text-xs">Not: {item.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {o.note && <div className="text-xs text-amber-400/70 mb-4 italic border-t border-stone-700 pt-3">Masa notu: {o.note}</div>}
                  {mins > 10 && <div className="text-rose-400 text-xs mb-3 font-semibold">⚠️ {mins} dakikadır bekliyor!</div>}
                  <button onClick={() => markReady(o.id)}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-sm transition">
                    ✓ Hazır
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
