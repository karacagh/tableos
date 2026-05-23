'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import socket from '@/lib/socket';
import toast from 'react-hot-toast';

interface OrderItem { name: string; quantity: number; unit_price: number; }
interface Order { id: number; status: string; items: OrderItem[]; created_at: string; }
interface Table { id: number; number: number; zone: string; }
interface Bill { id: number; table_id: number; total: number; status: string; opened_at: string; }

export default function CashierPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'card'|'meal_card'>('cash');
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [t, o, b] = await Promise.all([
        api.get('/api/tables'),
        api.get('/api/orders'),
        api.get('/api/bills'),
      ]);
      setTables(t.data);
      setOrders(o.data);
      setBills(b.data);
    } catch { toast.error('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager','cashier'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadAll();
    socket.connect();
    socket.on('new_order', loadAll);
    socket.on('order_updated', loadAll);
    socket.on('bill_closed', loadAll);
    return () => { socket.off('new_order'); socket.off('order_updated'); socket.off('bill_closed'); socket.disconnect(); };
  }, [loadAll]);

  function getTableOrders(tableId: number) {
    return orders.filter(o => {
      const bill = bills.find(b => b.table_id === tableId && b.status === 'open');
      return !bill;
    });
  }

  function getTableTotal(tableId: number): number {
    const tableOrders = orders.filter(o => ['pending','preparing','ready','delivered'].includes(o.status));
    return tableOrders.reduce((sum, o) => {
      return sum + (o.items?.reduce((s, i) => s + (i.quantity * i.unit_price), 0) || 0);
    }, 0);
  }

  function getTableBill(tableId: number) {
    return bills.find(b => b.table_id === tableId && b.status === 'open');
  }

  async function openBill(table: Table) {
    const tableOrders = orders.filter(o => !['cancelled'].includes(o.status));
    if (tableOrders.length === 0) { toast.error('Bu masada sipariş yok'); return; }
    try {
      const total = getTableTotal(table.id);
      await api.post('/api/bills', {
        table_id: table.id,
        order_ids: tableOrders.map(o => o.id),
        total,
      });
      toast.success('Adisyon açıldı');
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Hata oluştu');
    }
  }

  async function closeBill(billId: number) {
    if (!confirm('Hesabı kapatmak ve ödemeyi almak istiyor musunuz?')) return;
    setClosing(true);
    try {
      await api.patch(`/api/bills/${billId}/close`, { payment_method: paymentMethod });
      toast.success('Hesap kapatıldı, masa boşaltıldı');
      setSelectedTable(null);
      loadAll();
    } catch { toast.error('Hata oluştu'); }
    finally { setClosing(false); }
  }

  function logout() { clearAuth(); router.replace('/login'); }

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  const zones = [...new Set(tables.map(t => t.zone))].sort();
  const openBills = bills.filter(b => b.status === 'open');

  return (
    <div className="min-h-screen bg-stone-900 text-white flex">
      {/* Sol: Masalar */}
      <div className="flex-1 flex flex-col">
        <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-amber-500">Kasa Ekranı</h1>
            <p className="text-stone-400 text-xs mt-0.5">{user?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-amber-400 text-sm font-semibold">{openBills.length} açık adisyon</span>
            <button onClick={logout} className="text-stone-500 hover:text-white text-sm transition">Çıkış</button>
          </div>
        </header>

        <div className="p-6 overflow-auto">
          {zones.map(zone => (
            <div key={zone} className="mb-6">
              <h2 className="text-stone-400 text-sm font-semibold uppercase tracking-wider mb-3 border-b border-stone-700 pb-2">{zone}</h2>
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {tables.filter(t => t.zone === zone).map(t => {
                  const bill = getTableBill(t.id);
                  const hasOrders = orders.some(o => !['cancelled'].includes(o.status));
                  const isSelected = selectedTable?.id === t.id;
                  return (
                    <button key={t.id} onClick={() => setSelectedTable(isSelected ? null : t)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center border-2 transition font-bold text-lg
                        ${isSelected ? 'border-amber-400 bg-amber-500/20' :
                          bill ? 'border-green-500 bg-green-500/10 text-green-400' :
                          hasOrders ? 'border-blue-500 bg-blue-500/10 text-blue-400' :
                          'border-stone-700 bg-stone-800 text-stone-400 hover:border-stone-500'}`}>
                      <span>{t.number}</span>
                      {bill && <span className="text-xs font-normal mt-1">₺{bill.total}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sağ: Adisyon Detayı */}
      {selectedTable && (
        <div className="w-80 bg-stone-800 border-l border-stone-700 flex flex-col">
          <div className="p-5 border-b border-stone-700">
            <div className="font-bold text-amber-400 text-lg">{selectedTable.zone} - Masa {selectedTable.number}</div>
            <div className="text-stone-400 text-sm">Adisyon Detayı</div>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {orders.length === 0 ? (
              <div className="text-stone-500 text-sm text-center py-8">Bu masada sipariş yok</div>
            ) : (
              <div className="space-y-2">
                {orders.map(o => o.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-stone-300">{item.quantity}x {item.name}</span>
                    <span className="text-stone-400">₺{(item.quantity * item.unit_price).toFixed(2)}</span>
                  </div>
                )))}
              </div>
            )}
          </div>
          <div className="p-5 border-t border-stone-700">
            <div className="flex justify-between font-bold text-lg mb-4">
              <span>Toplam</span>
              <span className="text-amber-400">₺{getTableTotal(selectedTable.id).toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['cash','card','meal_card'] as const).map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={`py-2 rounded-lg text-xs font-semibold transition border ${paymentMethod === m ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-stone-700 text-stone-400 hover:border-stone-500'}`}>
                  {m === 'cash' ? 'Nakit' : m === 'card' ? 'Kart' : 'Yemek Kartı'}
                </button>
              ))}
            </div>
            {getTableBill(selectedTable.id) ? (
              <button onClick={() => closeBill(getTableBill(selectedTable.id)!.id)} disabled={closing}
                className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl font-bold transition">
                {closing ? 'Kapatılıyor...' : '✓ Hesabı Kapat'}
              </button>
            ) : (
              <button onClick={() => openBill(selectedTable)}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-stone-900 rounded-xl font-bold transition">
                Adisyon Aç
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
