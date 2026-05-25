'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import socket from '@/lib/socket';
import toast from 'react-hot-toast';

interface OrderItem { id: number; name: string; quantity: number; unit_price: number; note: string; is_paid?: boolean; }
interface Order { id: number; status: string; table_id: number; waiter_name: string; kitchen_name: string; created_at: string; items: OrderItem[]; }
interface Table { id: number; number: number; zone: string; }
interface Bill { id: number; table_id: number; total: number; status: string; note: string; discount_amount: number; }
interface Notification { id: number; sender_name: string; sender_role: string; message: string; type: string; is_read: boolean; created_at: string; }

type PaymentMethod = 'cash' | 'card' | 'meal_card';
type CashierView = 'tables' | 'bill' | 'split' | 'payment';

export default function CashierPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [view, setView] = useState<CashierView>('tables');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const [billItems, setBillItems] = useState<Record<number, OrderItem[]>>({});

  const loadAll = useCallback(async () => {
    try {
      const [t, o, b, n] = await Promise.all([
        api.get('/api/tables'),
        api.get('/api/orders'),
        api.get('/api/bills'),
        api.get('/api/notifications?target_role=cashier'),
      ]);
      setTables(t.data);
      setOrders(o.data);
      setBills(b.data);
      setNotifications(n.data);
    } catch { toast.error('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }, []);

  async function loadBillItems(billId: number) {
    try {
      const res = await api.get(`/api/bills/${billId}/items`);
      setBillItems(prev => ({ ...prev, [billId]: res.data }));
    } catch {}
  }

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager','cashier'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadAll();
    socket.connect();
    socket.on('new_order', () => { loadAll(); toast('🛎 Yeni sipariş!'); });
    socket.on('order_updated', loadAll);
    socket.on('bill_closed', loadAll);
    socket.on('bill_updated', loadAll);
    socket.on('new_notification', (n: any) => {
      if (n.target_role === 'cashier' || n.target_role === 'all') {
        toast(`📢 ${n.sender_name}: ${n.message}`, { duration: 5000 });
        loadAll();
      }
    });
    return () => {
      socket.off('new_order'); socket.off('order_updated');
      socket.off('bill_closed'); socket.off('bill_updated');
      socket.off('new_notification'); socket.disconnect();
    };
  }, [loadAll]);

  useEffect(() => {
    if (!selectedTable) {
      socket.emit('customer_screen_hide');
      return;
    }
    const items = getAllItems(selectedTable.id);
    const total = getTableTotal(selectedTable.id);
    if (items.length > 0) {
      socket.emit('customer_screen_show', {
        table_zone: selectedTable.zone,
        table_number: selectedTable.number,
        items,
        total,
        status: 'open',
      });
    }
  }, [selectedTable, orders]);

  useEffect(() => {
    if (selectedTable) {
      const b = getTableBill(selectedTable.id);
      if (b) loadBillItems(b.id);
    }
  }, [selectedTable, bills]);

  function getTableOrders(tableId: number) {
    return orders.filter(o =>
      o.table_id === tableId &&
      !['cancelled'].includes(o.status)
    );
  }

  function getTableBill(tableId: number) {
    return bills.find(b => b.table_id === tableId && b.status === 'open');
  }

  function getAllItems(tableId: number): OrderItem[] {
    const bill = getTableBill(tableId);
    if (bill && billItems[bill.id]) {
      return billItems[bill.id].filter(i => !i.is_paid);
    }
    return orders
      .filter(o => o.table_id === tableId && !['cancelled'].includes(o.status))
      .flatMap(o => o.items || []);
  }

  function getTableTotal(tableId: number): number {
    return getAllItems(tableId).reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  }

  function getSelectedTotal(): number {
    const items = selectedTable ? getAllItems(selectedTable.id) : [];
    const expandedItems = items.flatMap(item =>
      Array.from({ length: item.quantity }, (_, i) => ({
        ...item,
        _splitId: `${item.id}_${i}`,
        quantity: 1,
      }))
    );
    return expandedItems
      .filter(i => selectedItems.includes(i._splitId))
      .reduce((s, i) => s + i.unit_price, 0);
  }

  async function openBill(table: Table) {
    const tOrders = getTableOrders(table.id);
    if (tOrders.length === 0) { toast.error('Bu masada aktif sipariş yok'); return; }
    try {
      const total = getTableTotal(table.id);
      await api.post('/api/bills', { table_id: table.id, order_ids: tOrders.map(o => o.id), total });
      toast.success('Adisyon açıldı');
      loadAll();
      setView('bill');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Hata'); }
  }

  async function closeBill(billId: number) {
    if (!confirm('Hesabı kapatmak istiyor musunuz?')) return;
    setClosing(true);
    try {
      await api.patch(`/api/bills/${billId}/close`, { payment_method: paymentMethod });
      toast.success('✅ Hesap kapatıldı, masa boşaltıldı');
      socket.emit('customer_screen_paid');
      setTimeout(() => socket.emit('customer_screen_hide'), 4000);
      setSelectedTable(null);
      setView('tables');
      setSelectedItems([]);
      setBillItems({});
      loadAll();
    } catch { toast.error('Hata'); }
    finally { setClosing(false); }
  }

  async function splitPayment(billId: number) {
    if (selectedItems.length === 0) { toast.error('Kalem seçin'); return; }
    setClosing(true);
    try {
      const itemIds = selectedItems.map(sid => parseInt(sid.split('_')[0]));
      const res = await api.post(`/api/bills/${billId}/split`, { item_ids: itemIds, payment_method: paymentMethod });
      toast.success(`Ödeme alındı. Kalan: ${res.data.remaining_items} kalem`);
      if (res.data.remaining_items === 0) {
        setSelectedTable(null); setView('tables');
      } else {
        setSelectedItems([]);
        setView('bill');
      }
      const bill = getTableBill(selectedTable!.id);
      if (bill) loadBillItems(bill.id);
      loadAll();
    } catch { toast.error('Hata'); }
    finally { setClosing(false); }
  }

  async function cancelItem(billId: number, itemId: number) {
    if (!confirm('Bu kalemi iptal etmek istiyor musunuz?')) return;
    try {
      await api.patch(`/api/bills/${billId}/cancel-item`, { order_item_id: itemId });
      toast.success('Kalem iptal edildi');
      loadAll();
    } catch { toast.error('Hata'); }
  }

  async function sendNotification() {
    if (!notifMessage.trim()) return;
    try {
      await api.post('/api/notifications', { message: notifMessage, target_role: 'manager', type: 'info' });
      toast.success('Bildirim gönderildi');
      setNotifMessage('');
      setShowNotif(false);
    } catch { toast.error('Hata'); }
  }

  async function markRead(id: number) {
    await api.patch(`/api/notifications/${id}/read`);
    loadAll();
  }

  function logout() { clearAuth(); router.replace('/login'); }

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  const zones = [...new Set(tables.map(t => t.zone))].sort();
  const openBillsCount = bills.filter(b => b.status === 'open').length;
  const unreadNotifs = notifications.filter(n => !n.is_read).length;
  const bill = selectedTable ? getTableBill(selectedTable.id) : null;
  const allItems = selectedTable ? getAllItems(selectedTable.id) : [];

  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          {selectedTable && view !== 'tables' && (
            <button onClick={() => { setView('tables'); setSelectedTable(null); setSelectedItems([]); }}
              className="text-stone-400 hover:text-white transition text-sm">← Masalar</button>
          )}
          <h1 className="text-lg font-bold text-amber-500">Kasa</h1>
          {selectedTable && (
            <span className="text-stone-400 text-sm">{selectedTable.zone} · Masa {selectedTable.number}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-sm font-semibold">{openBillsCount} açık adisyon</span>

          {/* Müşteri ekranı butonu */}
          <a href="/cashier/customer" target="_blank"
            className="bg-stone-700 hover:bg-stone-600 px-3 py-2 rounded-lg text-xs transition flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            Müşteri Ekranı
          </a>

          {/* Bildirim butonu */}
          <button onClick={() => setShowNotif(!showNotif)} className="relative text-stone-400 hover:text-white transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadNotifs > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-xs flex items-center justify-center">{unreadNotifs}</span>
            )}
          </button>
          <button onClick={logout} className="text-stone-500 hover:text-white text-sm transition">Çıkış</button>
        </div>
      </header>

      {/* Bildirim Paneli */}
      {showNotif && (
        <div className="bg-stone-800 border-b border-stone-700 px-6 py-4">
          <div className="max-w-2xl">
            <div className="flex gap-2 mb-3">
              <input value={notifMessage} onChange={e => setNotifMessage(e.target.value)}
                placeholder="Yöneticiye mesaj gönder..."
                className="flex-1 bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              <button onClick={sendNotification}
                className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
                Gönder
              </button>
            </div>
            {notifications.slice(0,5).map(n => (
              <div key={n.id} className={`flex items-start gap-3 py-2 border-b border-stone-700 last:border-0 ${!n.is_read ? 'opacity-100' : 'opacity-50'}`}>
                <div className="flex-1 text-sm">
                  <span className="text-amber-400 font-medium">{n.sender_name}</span>
                  <span className="text-stone-400 mx-1">→</span>
                  <span className="text-stone-300">{n.message}</span>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="text-stone-500 hover:text-white text-xs">✓</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sol: Masa Grid */}
        <div className="flex-1 overflow-auto p-6">
          {view === 'tables' && (
            <>
              {zones.map(zone => (
                <div key={zone} className="mb-6">
                  <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-3 border-b border-stone-700 pb-2">{zone}</h2>
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {tables.filter(t => t.zone === zone).map(t => {
                      const tBill = getTableBill(t.id);
                      const tOrders = getTableOrders(t.id);
                      const hasOrders = tOrders.length > 0;
                      const total = tOrders.reduce((s, o) =>
                        s + (o.items?.reduce((ss, i) => ss + (i.quantity * i.unit_price), 0) || 0), 0
                      );
                      const isSelected = selectedTable?.id === t.id;
                      return (
                        <button key={t.id} onClick={() => { setSelectedTable(t); setView('bill'); setSelectedItems([]); }}
                          className={`aspect-square rounded-xl flex flex-col items-center justify-center border-2 transition font-bold text-base p-2
                            ${isSelected ? 'border-amber-400 bg-amber-500/20' :
                              tBill ? 'border-green-500 bg-green-500/10 text-green-400' :
                              hasOrders ? 'border-blue-400 bg-blue-500/10 text-blue-300' :
                              'border-stone-700 bg-stone-800 text-stone-500 hover:border-stone-500'}`}>
                          <span className="text-lg font-bold">{t.number}</span>
                          {total > 0 && <span className="text-xs font-normal mt-1">₺{total.toFixed(0)}</span>}
                          {hasOrders && !tBill && <span className="text-xs font-normal text-blue-400">sipariş var</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Adisyon Detayı */}
          {selectedTable && view === 'bill' && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-amber-400">{selectedTable.zone} · Masa {selectedTable.number}</h2>
                <div className="flex gap-2">
                  {bill && (
                    <button onClick={() => setView('split')}
                      className="bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg text-sm hover:bg-blue-500/30 transition">
                      Hesap Böl
                    </button>
                  )}
                  {!bill && (
                    <button onClick={() => openBill(selectedTable)}
                      className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-1.5 rounded-lg text-sm transition">
                      Adisyon Aç
                    </button>
                  )}
                </div>
              </div>

              {/* Sipariş Listesi */}
              {allItems.length === 0 ? (
                <div className="text-stone-500 text-center py-12">Bu masada aktif sipariş yok</div>
              ) : (
                <div className="space-y-2 mb-4">
                  {allItems.map(item => (
                    <div key={item.id} className="bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-white">{item.name}</div>
                        {item.note && <div className="text-amber-400/70 text-xs">Not: {item.note}</div>}
                      </div>
                      <div className="text-stone-400 text-sm">{item.quantity}x</div>
                      <div className="text-amber-400 font-semibold w-20 text-right">₺{(item.quantity * item.unit_price).toFixed(2)}</div>
                      {bill && (
                        <button onClick={() => cancelItem(bill.id, item.id)}
                          className="text-rose-400 hover:text-rose-300 text-xs transition ml-2">İptal</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Toplam & Ödeme */}
              {allItems.length > 0 && (
                <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
                  {bill?.discount_amount && bill.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-green-400 mb-2">
                      <span>İndirim</span><span>-₺{bill.discount_amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg mb-4">
                    <span>Toplam</span>
                    <span className="text-amber-400">₺{getTableTotal(selectedTable.id).toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {(['cash','card','meal_card'] as PaymentMethod[]).map(m => (
                      <button key={m} onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-lg text-sm font-semibold transition border ${paymentMethod === m ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-stone-600 text-stone-400 hover:border-stone-500'}`}>
                        {m === 'cash' ? '💵 Nakit' : m === 'card' ? '💳 Kart' : '🍽 Yemek Kartı'}
                      </button>
                    ))}
                  </div>
                  {bill ? (
                    <button onClick={() => closeBill(bill.id)} disabled={closing}
                      className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl font-bold transition text-lg">
                      {closing ? 'Kapatılıyor...' : '✓ Hesabı Kapat & Ödemeyi Al'}
                    </button>
                  ) : (
                    <button onClick={() => openBill(selectedTable)}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-stone-900 rounded-xl font-bold transition">
                      Adisyon Aç
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hesap Bölme Ekranı */}
          {selectedTable && view === 'split' && bill && (
            <div className="max-w-2xl">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-blue-400 mb-1">Hesap Böl</h2>
                <p className="text-stone-400 text-sm">Ödeyeceğiniz kalemleri seçin</p>
              </div>
              {(() => {
                const expandedItems = allItems.flatMap(item =>
                  Array.from({ length: item.quantity }, (_, i) => ({
                    ...item,
                    _splitId: `${item.id}_${i}`,
                    quantity: 1,
                  }))
                );
                return (
                  <>
                    <div className="space-y-2 mb-4">
                      {expandedItems.map(item => {
                        const isSelected = selectedItems.includes(item._splitId);
                        return (
                          <button key={item._splitId} onClick={() => setSelectedItems(prev => isSelected ? prev.filter(id => id !== item._splitId) : [...prev, item._splitId])}
                            className={`w-full bg-stone-800 border rounded-xl px-4 py-3 flex items-center gap-3 transition text-left ${isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-stone-700 hover:border-stone-500'}`}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-stone-600'}`}>
                              {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-white">{item.name}</div>
                            </div>
                            <div className="text-amber-400 font-semibold">₺{item.unit_price.toFixed(2)}</div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="bg-stone-800 border border-stone-700 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <button onClick={() => setSelectedItems(expandedItems.map(i => i._splitId))}
                          className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 rounded-lg text-sm transition">Hepsini Seç</button>
                        <button onClick={() => setSelectedItems([])}
                          className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 rounded-lg text-sm transition">Temizle</button>
                      </div>
                      <div className="flex justify-between font-bold text-lg mb-4">
                        <span>Seçilen Toplam</span>
                        <span className="text-amber-400">₺{getSelectedTotal().toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {(['cash','card','meal_card'] as PaymentMethod[]).map(m => (
                          <button key={m} onClick={() => setPaymentMethod(m)}
                            className={`py-2 rounded-lg text-sm font-semibold transition border ${paymentMethod === m ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-stone-600 text-stone-400 hover:border-stone-500'}`}>
                            {m === 'cash' ? '💵 Nakit' : m === 'card' ? '💳 Kart' : '🍽 Yemek'}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => splitPayment(bill.id)} disabled={closing || selectedItems.length === 0}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-bold transition">
                        {closing ? 'İşleniyor...' : `Seçilenleri Öde (₺${getSelectedTotal().toFixed(2)})`}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Sağ: Aktif Siparişler Özeti */}
        <div className="w-72 bg-stone-800 border-l border-stone-700 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-700">
            <div className="text-stone-400 text-xs font-semibold uppercase tracking-wider">Tüm Aktif Siparişler</div>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {orders.filter(o => !['delivered','cancelled'].includes(o.status)).length === 0 ? (
              <div className="text-stone-600 text-sm text-center py-8">Aktif sipariş yok</div>
            ) : (
              orders.filter(o => !['delivered','cancelled'].includes(o.status)).map(o => {
                const table = tables.find(t => t.id === o.table_id);
                const total = o.items?.reduce((s, i) => s + (i.quantity * i.unit_price), 0) || 0;
                const statusColors: Record<string, string> = {
                  pending: 'text-rose-400', preparing: 'text-amber-400',
                  ready: 'text-green-400', delivered: 'text-stone-500'
                };
                const statusLabels: Record<string, string> = {
                  pending: 'Bekliyor', preparing: 'Hazırlanıyor',
                  ready: 'Hazır', delivered: 'Teslim Edildi'
                };
                return (
                  <div key={o.id} className="bg-stone-900 rounded-lg p-3 cursor-pointer hover:bg-stone-700 transition"
                    onClick={() => { const t = tables.find(t => t.id === o.table_id); if (t) { setSelectedTable(t); setView('bill'); } }}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-semibold text-sm">{table?.zone} · M.{table?.number}</div>
                      <span className={`text-xs font-medium ${statusColors[o.status]}`}>{statusLabels[o.status]}</span>
                    </div>
                    <div className="text-stone-500 text-xs">{o.items?.length} kalem</div>
                    <div className="text-amber-400 text-sm font-semibold mt-1">₺{total.toFixed(2)}</div>
                    {o.waiter_name && <div className="text-stone-600 text-xs mt-1">Garson: {o.waiter_name}</div>}
                    {o.kitchen_name && <div className="text-stone-600 text-xs">Mutfak: {o.kitchen_name}</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
