'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import socket from '@/lib/socket';
import toast from 'react-hot-toast';

interface OrderItem { id: number; name: string; quantity: number; unit_price: number; note: string; }
interface Order {
  id: number; table_number: number; table_zone: string; table_id: number;
  status: string; note: string; created_at: string; updated_at: string;
  waiter_name: string; kitchen_name: string; items: OrderItem[];
}
interface Notification { id: number; sender_name: string; sender_role: string; message: string; type: string; is_read: boolean; created_at: string; }

const STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor', preparing: 'Hazırlanıyor', ready: 'Hazır!', delivered: 'Teslim Edildi'
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  preparing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ready: 'bg-green-500/20 text-green-400 border-green-500/30',
  delivered: 'bg-stone-500/20 text-stone-400 border-stone-500/30',
};

type TabType = 'active' | 'history';

export default function WaiterPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('active');
  const [showNotif, setShowNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState('manager');
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderTable, setOrderTable] = useState<number | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [orderCart, setOrderCart] = useState<{product: any; quantity: number; note: string}[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const loadOrders = useCallback(async (date?: string) => {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      const [ordersRes, notifsRes, tablesRes, productsRes] = await Promise.all([
        api.get(`/api/orders?${params}`),
        api.get('/api/notifications'),
        api.get('/api/tables'),
        api.get('/api/products'),
      ]);
      setOrders(ordersRes.data);
      setNotifications(notifsRes.data);
      setTables(tablesRes.data);
      setAllProducts(productsRes.data);
    } catch { toast.error('Veriler yüklenemedi'); }
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
    socket.on('order_ready', (data: any) => {
      toast.success(`✅ Sipariş #${data.order_id} hazır — teslim et!`, { duration: 6000 });
      loadOrders();
    });
    socket.on('new_notification', (n: any) => {
      if (['waiter','all'].includes(n.target_role)) {
        toast(`📢 ${n.sender_name}: ${n.message}`, { duration: 5000 });
        loadOrders();
      }
    });
    return () => {
      socket.off('new_order'); socket.off('order_updated');
      socket.off('order_ready'); socket.off('new_notification');
      socket.disconnect();
    };
  }, [loadOrders]);

  async function updateStatus(id: number, status: string) {
    try {
      await api.patch(`/api/orders/${id}/status`, { status });
      toast.success(STATUS_LABEL[status]);
      loadOrders();
    } catch { toast.error('Hata oluştu'); }
  }

  async function sendNotification() {
    if (!notifMessage.trim()) return;
    try {
      await api.post('/api/notifications', {
        message: notifMessage,
        target_role: notifTarget,
        type: 'info'
      });
      toast.success('Bildirim gönderildi');
      setNotifMessage('');
      setShowNotif(false);
    } catch { toast.error('Hata'); }
  }

  async function markRead(id: number) {
    await api.patch(`/api/notifications/${id}/read`);
    loadOrders();
  }

  function addToOrderCart(product: any) {
    setOrderCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? {...i, quantity: i.quantity + 1} : i);
      return [...prev, { product, quantity: 1, note: '' }];
    });
  }

  function removeFromOrderCart(productId: number) {
    setOrderCart(prev => {
      const existing = prev.find(i => i.product.id === productId);
      if (existing && existing.quantity > 1) return prev.map(i => i.product.id === productId ? {...i, quantity: i.quantity - 1} : i);
      return prev.filter(i => i.product.id !== productId);
    });
  }

  async function submitOrder() {
    if (!orderTable) { toast.error('Masa seçin'); return; }
    if (orderCart.length === 0) { toast.error('Ürün ekleyin'); return; }
    setSubmittingOrder(true);
    try {
      await api.post('/api/orders', {
        table_id: orderTable,
        waiter_id: user?.id,
        items: orderCart.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          note: i.note || null,
        })),
      });
      toast.success('Sipariş alındı');
      setShowOrderForm(false);
      setOrderCart([]);
      setOrderTable(null);
      setProductSearch('');
      loadOrders();
    } catch { toast.error('Hata oluştu'); }
    finally { setSubmittingOrder(false); }
  }

  function logout() { clearAuth(); router.replace('/login'); }

  const activeOrders = orders.filter(o => !['delivered','cancelled'].includes(o.status));
  const historyOrders = orders.filter(o => ['delivered','cancelled'].includes(o.status));
  const unreadNotifs = notifications.filter(n => !n.is_read).length;
  const pending = activeOrders.filter(o => o.status === 'pending');
  const preparing = activeOrders.filter(o => o.status === 'preparing');
  const ready = activeOrders.filter(o => o.status === 'ready');

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-amber-500">Garson Ekranı</h1>
          <p className="text-stone-500 text-xs">{user?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-xs">
            <span className="text-rose-400 font-semibold">{pending.length} bekliyor</span>
            <span className="text-amber-400 font-semibold">{preparing.length} hazırlanıyor</span>
            <span className="text-green-400 font-bold animate-pulse">{ready.length} hazır!</span>
          </div>
          <button onClick={() => setShowOrderForm(true)}
            className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
            + Sipariş Al
          </button>
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
        <div className="bg-stone-800 border-b border-stone-700 px-6 py-4">
          <div className="max-w-2xl">
            <div className="flex gap-2 mb-3">
              <select value={notifTarget} onChange={e => setNotifTarget(e.target.value)}
                className="bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
                <option value="manager">Yönetici</option>
                <option value="cashier">Kasa</option>
                <option value="kitchen">Mutfak</option>
              </select>
              <input value={notifMessage} onChange={e => setNotifMessage(e.target.value)}
                placeholder="Mesaj gönder..."
                className="flex-1 bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              <button onClick={sendNotification}
                className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
                Gönder
              </button>
            </div>
            {notifications.slice(0,5).map(n => (
              <div key={n.id} className={`flex items-start gap-3 py-2 border-b border-stone-700 last:border-0 ${!n.is_read ? 'opacity-100' : 'opacity-40'}`}>
                <div className="flex-1 text-sm">
                  <span className="text-amber-400 font-medium">{n.sender_name}</span>
                  <span className="text-stone-400 mx-1">→</span>
                  <span className="text-stone-300">{n.message}</span>
                  <span className="text-stone-600 ml-2 text-xs">{new Date(n.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}</span>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="text-stone-500 hover:text-white text-xs">✓</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-stone-800 border-b border-stone-700 px-6 py-2 flex items-center gap-4">
        <div className="flex gap-1 bg-stone-900 rounded-lg p-1">
          <button onClick={() => setTab('active')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'active' ? 'bg-amber-500 text-stone-900' : 'text-stone-400 hover:text-white'}`}>
            Aktif ({activeOrders.length})
          </button>
          <button onClick={() => { setTab('history'); loadOrders(historyDate); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === 'history' ? 'bg-amber-500 text-stone-900' : 'text-stone-400 hover:text-white'}`}>
            Geçmiş
          </button>
        </div>
        {tab === 'history' && (
          <input type="date" value={historyDate}
            onChange={e => { setHistoryDate(e.target.value); loadOrders(e.target.value); }}
            className="bg-stone-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
        )}
      </div>

      {/* Sipariş Al Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center">
          <div className="bg-stone-800 w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-700 flex-shrink-0">
              <h3 className="text-lg font-bold text-amber-500">Sipariş Al</h3>
              <button onClick={() => { setShowOrderForm(false); setOrderCart([]); setOrderTable(null); setProductSearch(''); }}
                className="text-stone-400 hover:text-white text-2xl">×</button>
            </div>

            {/* Masa Seçimi */}
            <div className="px-5 py-3 border-b border-stone-700 flex-shrink-0">
              <label className="text-stone-400 text-xs mb-2 block">Masa Seç</label>
              <div className="flex flex-wrap gap-2">
                {tables.map(t => (
                  <button key={t.id} onClick={() => setOrderTable(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                      orderTable === t.id
                        ? 'bg-amber-500 text-stone-900 border-amber-500'
                        : 'bg-stone-700 text-stone-300 border-stone-600 hover:border-stone-400'
                    }`}>
                    {t.zone} · {t.number}
                  </button>
                ))}
              </div>
            </div>

            {/* Ürün Arama */}
            <div className="px-5 py-3 border-b border-stone-700 flex-shrink-0">
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Ürün adı ara..."
                className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder-stone-500" />
            </div>

            {/* Ürün Listesi */}
            <div className="flex-1 overflow-auto px-5 py-3">
              <div className="space-y-2">
                {allProducts
                  .filter(p => p.is_active && p.name.toLowerCase().includes(productSearch.toLowerCase()))
                  .map(p => {
                    const cartItem = orderCart.find(i => i.product.id === p.id);
                    const price = p.is_campaign && p.campaign_price ? p.campaign_price : p.price;
                    return (
                      <div key={p.id} className="flex items-center gap-3 bg-stone-700 rounded-xl px-4 py-3">
                        {p.image_url && (
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{p.name}</div>
                          <div className="text-amber-400 text-xs font-semibold">₺{price}</div>
                        </div>
                        {cartItem ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => removeFromOrderCart(p.id)}
                              className="w-7 h-7 rounded-full bg-stone-600 flex items-center justify-center text-white font-bold hover:bg-stone-500">−</button>
                            <span className="text-amber-400 font-bold w-5 text-center">{cartItem.quantity}</span>
                            <button onClick={() => addToOrderCart(p)}
                              className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-stone-900 font-bold hover:bg-amber-600">+</button>
                          </div>
                        ) : (
                          <button onClick={() => addToOrderCart(p)}
                            className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-stone-900 font-bold hover:bg-amber-600 flex-shrink-0">+</button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Sepet Özeti + Gönder */}
            {orderCart.length > 0 && (
              <div className="px-5 py-4 border-t border-stone-700 flex-shrink-0 bg-stone-900/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-stone-300 text-sm">
                    {orderCart.reduce((s, i) => s + i.quantity, 0)} ürün
                  </div>
                  <div className="text-amber-400 font-bold">
                    ₺{orderCart.reduce((s, i) => s + (i.quantity * (i.product.is_campaign && i.product.campaign_price ? i.product.campaign_price : i.product.price)), 0).toFixed(2)}
                  </div>
                </div>
                {!orderTable && (
                  <p className="text-rose-400 text-xs mb-2">⚠️ Masa seçmeyi unutmayın</p>
                )}
                <button onClick={submitOrder} disabled={submittingOrder || !orderTable}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-bold rounded-xl transition">
                  {submittingOrder ? 'Gönderiliyor...' : `Siparişi Ver · ₺${orderCart.reduce((s, i) => s + (i.quantity * (i.product.is_campaign && i.product.campaign_price ? i.product.campaign_price : i.product.price)), 0).toFixed(2)}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* İçerik */}
      <main className="flex-1 overflow-auto p-6">
        {tab === 'active' && (
          activeOrders.length === 0 ? (
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
                    <OrderCard key={o.id} order={o}
                      actionLabel="Hazırlıyorum"
                      actionClass="bg-amber-500 hover:bg-amber-600 text-stone-900"
                      onAction={() => updateStatus(o.id, 'preparing')} />
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
                    <OrderCard key={o.id} order={o}
                      actionLabel="Hazır İşaretle"
                      actionClass="bg-green-600 hover:bg-green-500 text-white"
                      onAction={() => updateStatus(o.id, 'ready')} />
                  ))}
                </div>
              </div>
              {/* Hazır */}
              <div>
                <h2 className="text-green-400 font-semibold text-sm uppercase tracking-wider mb-3 border-b border-green-500/20 pb-2 animate-pulse">
                  Teslim Edilecek ({ready.length})
                </h2>
                <div className="space-y-3">
                  {ready.map(o => (
                    <OrderCard key={o.id} order={o}
                      actionLabel="✓ Teslim Et"
                      actionClass="bg-blue-600 hover:bg-blue-500 text-white"
                      onAction={() => updateStatus(o.id, 'delivered')} />
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {tab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-stone-400 text-sm font-semibold">
                {new Date(historyDate).toLocaleDateString('tr-TR', {day:'numeric',month:'long',year:'numeric'})} — {historyOrders.length} sipariş
              </h2>
              <div className="text-amber-400 font-semibold">
                Toplam: ₺{historyOrders.reduce((s, o) => s + (o.items?.reduce((ss, i) => ss + (i.quantity * i.unit_price), 0) || 0), 0).toFixed(2)}
              </div>
            </div>
            {historyOrders.length === 0 ? (
              <div className="text-center py-12 text-stone-500">Bu tarihte tamamlanan sipariş yok</div>
            ) : (
              <div className="space-y-2">
                {historyOrders.map(o => {
                  const total = o.items?.reduce((s, i) => s + (i.quantity * i.unit_price), 0) || 0;
                  const time = new Date(o.created_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
                  const deliveredTime = (o as any).delivered_at ? new Date((o as any).delivered_at).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'}) : null;
                  return (
                    <div key={o.id} className="bg-stone-800 border border-stone-700 rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-amber-400">{o.table_zone} · Masa {o.table_number}</div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[o.status]}`}>
                            {STATUS_LABEL[o.status]}
                          </span>
                          <span className="text-amber-400 font-semibold">₺{total.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-stone-500">
                        <span>Sipariş: {time}</span>
                        {deliveredTime && <span>Teslim: {deliveredTime}</span>}
                        {o.waiter_name && <span>Garson: {o.waiter_name}</span>}
                        {o.kitchen_name && <span>Mutfak: {o.kitchen_name}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {o.items?.map((item, i) => (
                          <span key={i} className="text-xs bg-stone-700 px-2 py-1 rounded-full text-stone-300">
                            {item.quantity}x {item.name}
                          </span>
                        ))}
                      </div>
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

function OrderCard({ order, onAction, actionLabel, actionClass }: {
  order: Order; onAction: () => void; actionLabel: string; actionClass: string;
}) {
  const time = new Date(order.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const total = order.items?.reduce((s, i) => s + (i.quantity * i.unit_price), 0) || 0;

  return (
    <div className={`bg-stone-800 border rounded-xl p-4 ${mins > 15 && order.status === 'pending' ? 'border-rose-500/50' : 'border-stone-700'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-bold text-amber-400">{order.table_zone} · Masa {order.table_number}</div>
          <div className="text-stone-500 text-xs">{time} · {mins} dk</div>
        </div>
        <div className="text-right">
          <div className="text-amber-400 font-semibold text-sm">₺{total.toFixed(2)}</div>
          <div className="text-stone-600 text-xs">#{order.id}</div>
        </div>
      </div>
      <div className="space-y-1 mb-3">
        {order.items?.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-stone-300">{item.quantity}x {item.name}</span>
            {item.note && <span className="text-amber-400/60 text-xs italic">{item.note}</span>}
          </div>
        ))}
      </div>
      {order.note && <div className="text-xs text-amber-400/70 mb-2 italic border-t border-stone-700 pt-2">Not: {order.note}</div>}
      {mins > 15 && order.status === 'pending' && (
        <div className="text-rose-400 text-xs mb-2 font-semibold">⚠️ {mins} dakikadır bekliyor!</div>
      )}
      <button onClick={onAction} className={`w-full py-2 rounded-lg text-sm font-semibold transition ${actionClass}`}>
        {actionLabel}
      </button>
    </div>
  );
}
