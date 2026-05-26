'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import socket from '@/lib/socket';
import toast from 'react-hot-toast';

interface OrderItem { id: number; name: string; quantity: number; note: string; }
interface Order {
  id: number; table_number: number; table_zone: string; table_id: number;
  status: string; note: string; created_at: string; delivered_at: string;
  waiter_name: string; kitchen_name: string; items: OrderItem[];
}
interface Notification { id: number; sender_name: string; sender_role: string; message: string; is_read: boolean; created_at: string; }

type TabType = 'active' | 'history';

export default function KitchenPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('active');
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [showNotif, setShowNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState('manager');
  const [now, setNow] = useState(Date.now());

  const loadOrders = useCallback(async (date?: string) => {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      const [ordersRes, notifsRes] = await Promise.all([
        api.get(`/api/orders?${params}`),
        api.get('/api/notifications'),
      ]);
      setOrders(ordersRes.data);
      setNotifications(notifsRes.data);
    } catch { toast.error('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager','kitchen'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadOrders();

    // Süre sayacı için interval
    const timer = setInterval(() => setNow(Date.now()), 30000);

    socket.connect();
    socket.on('new_order', () => { loadOrders(); toast('🔔 Yeni sipariş!', { duration: 4000 }); });
    socket.on('order_updated', () => loadOrders());
    socket.on('new_notification', (n: any) => {
      if (['kitchen','all'].includes(n.target_role)) {
        toast(`📢 ${n.sender_name}: ${n.message}`, { duration: 5000 });
        loadOrders();
      }
    });
    return () => {
      clearInterval(timer);
      socket.off('new_order'); socket.off('order_updated'); socket.off('new_notification');
      socket.disconnect();
    };
  }, [loadOrders]);

  async function markPreparing(id: number) {
    try {
      await api.patch(`/api/orders/${id}/status`, { status: 'preparing' });
      toast.success('Hazırlanıyor...');
      loadOrders();
    } catch { toast.error('Hata'); }
  }

  async function markReady(id: number) {
    try {
      await api.patch(`/api/orders/${id}/status`, { status: 'ready' });
      toast.success('✅ Hazır — garson bilgilendirildi');
      loadOrders();
    } catch { toast.error('Hata'); }
  }

  async function sendNotification() {
    if (!notifMessage.trim()) return;
    try {
      await api.post('/api/notifications', { message: notifMessage, target_role: notifTarget, type: 'info' });
      toast.success('Bildirim gönderildi');
      setNotifMessage('');
      setShowNotif(false);
    } catch { toast.error('Hata'); }
  }

  async function markRead(id: number) {
    await api.patch(`/api/notifications/${id}/read`);
    loadOrders();
  }

  function logout() { clearAuth(); router.replace('/login'); }

  const activeOrders = orders.filter(o => ['pending','preparing'].includes(o.status));
  const historyOrders = orders.filter(o => ['ready','delivered'].includes(o.status));
  const unreadNotifs = notifications.filter(n => !n.is_read).length;

  if (loading) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-stone-900 border-b border-stone-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-orange-400">Mutfak Ekranı</h1>
          <p className="text-stone-500 text-xs">{user?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-orange-400 font-bold text-sm">{activeOrders.length} aktif sipariş</span>
          <button onClick={() => setShowNotif(!showNotif)} className="relative text-stone-400 hover:text-white transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadNotifs > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-xs flex items-center justify-center">{unreadNotifs}</span>
            )}
          </button>
          <span className="text-stone-400 text-sm">{user?.name}</span>
          <button onClick={logout}
            className="text-stone-500 hover:text-white text-sm transition border border-stone-700 hover:border-stone-500 px-3 py-1 rounded-lg">
            Çıkış
          </button>
        </div>
      </header>

      {/* Bildirim Paneli */}
      {showNotif && (
        <div className="bg-stone-900 border-b border-stone-800 px-6 py-4">
          <div className="max-w-2xl">
            <div className="flex gap-2 mb-3">
              <select value={notifTarget} onChange={e => setNotifTarget(e.target.value)}
                className="bg-stone-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500">
                <option value="manager">Yönetici</option>
                <option value="waiter">Garson</option>
                <option value="cashier">Kasa</option>
              </select>
              <input value={notifMessage} onChange={e => setNotifMessage(e.target.value)}
                placeholder="Mesaj gönder... (malzeme bitti, fırın arızası vb.)"
                className="flex-1 bg-stone-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500" />
              <button onClick={sendNotification}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
                Gönder
              </button>
            </div>
            {notifications.slice(0,5).map(n => (
              <div key={n.id} className={`flex items-start gap-3 py-2 border-b border-stone-800 last:border-0 ${!n.is_read ? 'opacity-100' : 'opacity-40'}`}>
                <div className="flex-1 text-sm">
                  <span className="text-orange-400 font-medium">{n.sender_name}</span>
                  <span className="text-stone-500 mx-1">→</span>
                  <span className="text-stone-300">{n.message}</span>
                  <span className="text-stone-600 ml-2 text-xs">{new Date(n.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
                {!n.is_read && <button onClick={() => markRead(n.id)} className="text-stone-500 hover:text-white text-xs">✓</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-stone-900 border-b border-stone-800 px-6 py-2 flex items-center gap-4">
        <div className="flex gap-1 bg-stone-950 rounded-lg p-1">
          <button onClick={() => setTab('active')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'active' ? 'bg-orange-500 text-white' : 'text-stone-400 hover:text-white'}`}>
            Aktif ({activeOrders.length})
          </button>
          <button onClick={() => { setTab('history'); loadOrders(historyDate); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'history' ? 'bg-orange-500 text-white' : 'text-stone-400 hover:text-white'}`}>
            Geçmiş
          </button>
        </div>
        {tab === 'history' && (
          <input type="date" value={historyDate}
            onChange={e => { setHistoryDate(e.target.value); loadOrders(e.target.value); }}
            className="bg-stone-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-500" />
        )}
      </div>

      {/* İçerik */}
      <main className="flex-1 overflow-auto p-6">
        {tab === 'active' && (
          activeOrders.length === 0 ? (
            <div className="text-center py-20 text-stone-600">
              <div className="text-5xl mb-3">👨‍🍳</div>
              <div>Hazırlanacak sipariş yok</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeOrders.map(o => {
                const mins = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
                const time = new Date(o.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
                const isUrgent = mins > 10;
                const isPending = o.status === 'pending';
                return (
                  <div key={o.id} className={`border rounded-xl p-5 transition ${isUrgent ? 'border-rose-500/60 bg-rose-950/20' : isPending ? 'border-amber-500/30 bg-stone-900' : 'border-green-500/30 bg-stone-900'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-xl font-bold text-orange-400">{o.table_zone} · Masa {o.table_number}</div>
                        <div className="text-stone-500 text-sm">{time} · {mins} dk önce</div>
                        {o.waiter_name && <div className="text-stone-600 text-xs mt-0.5">Garson: {o.waiter_name}</div>}
                      </div>
                      <div className={`text-xs font-bold px-3 py-1 rounded-full ${isPending ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {isPending ? '🔴 YENİ' : '🟡 HAZIRLANIYOR'}
                      </div>
                    </div>

                    {/* Ürünler — büyük ve net */}
                    <div className="space-y-3 mb-4">
                      {o.items?.map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center text-orange-400 font-bold text-lg flex-shrink-0">
                            {item.quantity}
                          </div>
                          <div>
                            <div className="text-white font-semibold">{item.name}</div>
                            {item.note && <div className="text-amber-400/70 text-xs">Not: {item.note}</div>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {o.note && (
                      <div className="text-xs text-amber-400/70 mb-4 italic border-t border-stone-800 pt-3">
                        Masa notu: {o.note}
                      </div>
                    )}

                    {isUrgent && (
                      <div className="text-rose-400 text-xs mb-3 font-bold">
                        ⚠️ {mins} dakikadır bekliyor!
                      </div>
                    )}

                    {isPending ? (
                      <button onClick={() => markPreparing(o.id)}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-stone-900 rounded-xl font-bold text-sm transition">
                        Hazırlamaya Başla
                      </button>
                    ) : (
                      <button onClick={() => markReady(o.id)}
                        className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-sm transition">
                        ✓ Hazır — Garsona Bildir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-stone-400 text-sm font-semibold">
                {new Date(historyDate).toLocaleDateString('tr-TR', {day:'numeric',month:'long',year:'numeric'})} — {historyOrders.length} sipariş tamamlandı
              </h2>
            </div>
            {historyOrders.length === 0 ? (
              <div className="text-center py-12 text-stone-600">Bu tarihte tamamlanan sipariş yok</div>
            ) : (
              <div className="space-y-2">
                {historyOrders.map(o => {
                  const time = new Date(o.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
                  const readyTime = o.delivered_at ? new Date(o.delivered_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : null;
                  const waitMins = o.delivered_at ? Math.floor((new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000) : null;
                  return (
                    <div key={o.id} className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-orange-400">{o.table_zone} · Masa {o.table_number}</div>
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>Sipariş: {time}</span>
                          {readyTime && <span>Teslim: {readyTime}</span>}
                          {waitMins !== null && (
                            <span className={`font-semibold ${waitMins > 15 ? 'text-rose-400' : 'text-green-400'}`}>
                              {waitMins} dk
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {o.items?.map((item, i) => (
                          <span key={i} className="text-xs bg-stone-800 px-2 py-1 rounded-full text-stone-400">
                            {item.quantity}x {item.name}
                          </span>
                        ))}
                      </div>
                      {o.kitchen_name && (
                        <div className="text-stone-600 text-xs mt-1">Hazırlayan: {o.kitchen_name}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
