'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({ tables: 0, products: 0, activeOrders: 0, staff: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) {
      router.replace('/login');
      return;
    }
    setUser(u);
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [tables, products, orders, users] = await Promise.all([
        api.get('/api/tables'),
        api.get('/api/products'),
        api.get('/api/orders'),
        api.get('/api/users'),
      ]);
      setStats({
        tables: tables.data.length,
        products: products.data.length,
        activeOrders: orders.data.length,
        staff: users.data.length,
      });
    } catch (err) {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearAuth();
    router.replace('/login');
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      {/* Header */}
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-amber-500">Monet Cafe</h1>
          <p className="text-stone-400 text-xs mt-0.5">Yönetim Paneli</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-stone-300 text-sm">{user?.name}</span>
          <button onClick={logout} className="text-stone-400 hover:text-white text-sm transition">
            Çıkış
          </button>
        </div>
      </header>

      <main className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Toplam Masa', value: stats.tables, color: 'text-amber-400' },
            { label: 'Ürün Sayısı', value: stats.products, color: 'text-green-400' },
            { label: 'Aktif Sipariş', value: stats.activeOrders, color: 'text-blue-400' },
            { label: 'Personel', value: stats.staff, color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="bg-stone-800 rounded-xl p-5 border border-stone-700">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-stone-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Nav Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Menü Yönetimi', desc: 'Kategori, ürün, kampanya', href: '/dashboard/menu', color: 'bg-amber-500' },
            { label: 'Masa Yönetimi', desc: 'Masa ekle, QR oluştur', href: '/dashboard/tables', color: 'bg-blue-500' },
            { label: 'Personel', desc: 'Kullanıcı ve rol yönetimi', href: '/dashboard/staff', color: 'bg-purple-500' },
            { label: 'Siparişler', desc: 'Aktif sipariş takibi', href: '/dashboard/orders', color: 'bg-green-500' },
            { label: 'Raporlar', desc: 'Satış ve adisyon raporları', href: '/dashboard/reports', color: 'bg-rose-500' },
            { label: 'Ayarlar', desc: 'Cafe ayarları', href: '/dashboard/settings', color: 'bg-stone-500' },
          ].map(card => (
            <a key={card.href} href={card.href}
              className="bg-stone-800 border border-stone-700 rounded-xl p-5 hover:border-stone-500 transition group">
              <div className={`w-2 h-2 rounded-full ${card.color} mb-3`}></div>
              <div className="font-semibold text-white group-hover:text-amber-400 transition">{card.label}</div>
              <div className="text-stone-400 text-sm mt-1">{card.desc}</div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
