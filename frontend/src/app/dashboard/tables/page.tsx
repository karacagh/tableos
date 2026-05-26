'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

interface Table {
  id: number;
  number: number;
  name: string;
  capacity: number;
  is_active: boolean;
  qr_code: string;
  zone: string;
}

export default function TablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ number: '', name: '', capacity: '4', zone: 'İçeri' });
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadTables();
  }, []);

  function logout() { clearAuth(); router.replace('/login'); }

  async function loadTables() {
    try {
      const res = await api.get('/api/tables');
      setTables(res.data);
    } catch { toast.error('Masalar yüklenemedi'); }
    finally { setLoading(false); }
  }

  async function addTable(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/tables', {
        number: parseInt(form.number),
        name: form.name || `Masa ${form.number}`,
        capacity: parseInt(form.capacity),
        zone: form.zone,
      });
      toast.success('Masa eklendi');
      setForm({ number: '', name: '', capacity: '4', zone: 'İçeri' });
      setShowForm(false);
      loadTables();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Hata oluştu');
    } finally { setSaving(false); }
  }

  async function deleteTable(id: number) {
    if (!confirm('Bu masayı silmek istiyor musunuz?')) return;
    try {
      await api.delete(`/api/tables/${id}`);
      toast.success('Masa silindi');
      loadTables();
    } catch { toast.error('Hata oluştu'); }
  }

  async function downloadQR(table: Table) {
    try {
      const url = await QRCode.toDataURL(table.qr_code, {
        width: 512,
        margin: 2,
        color: { dark: '#1a0e08', light: '#faf6f0' }
      });
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR_${table.zone}_Masa${table.number}.png`;
      link.click();
    } catch { toast.error('QR oluşturulamadı'); }
  }

  async function printQR(table: Table) {
    try {
      const url = await QRCode.toDataURL(table.qr_code, { width: 512, margin: 2 });
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`
        <html><head><title>QR - ${table.zone} Masa ${table.number}</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #fff; }
          img { width: 280px; height: 280px; display: block; margin: 0 auto 20px; }
          h2 { font-size: 24px; margin: 0 0 8px; color: #1a0e08; }
          p { font-size: 16px; color: #7a6a5a; margin: 0 0 6px; }
          small { font-size: 11px; color: #aaa; }
          @media print { button { display: none; } }
        </style></head>
        <body>
          <img src="${url}" />
          <h2>${table.zone} · Masa ${table.number}</h2>
          <p>Sipariş vermek için QR kodu okutun</p>
          <small>${table.qr_code}</small>
          <br><br>
          <button onclick="window.print()" style="padding:10px 24px;background:#1a0e08;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">Yazdır</button>
        </body></html>
      `);
      win.document.close();
    } catch { toast.error('QR yazdırılamadı'); }
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  const zones = [...new Set(tables.map(t => t.zone))].sort();

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-stone-400 hover:text-white transition text-sm">← Geri</a>
          <h1 className="text-lg font-bold text-amber-500">Masa Yönetimi</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-stone-400 text-sm">{user?.name}</span>
            <button onClick={logout}
              className="text-stone-500 hover:text-white text-sm transition border border-stone-700 hover:border-stone-500 px-3 py-1 rounded-lg">
              Çıkış
            </button>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
            + Yeni Masa
          </button>
        </div>
      </header>

      <main className="p-6">
        {showForm && (
          <form onSubmit={addTable} className="bg-stone-800 border border-stone-700 rounded-xl p-5 mb-6 grid grid-cols-4 gap-4">
            <div>
              <label className="text-stone-400 text-xs mb-1 block">Bölge</label>
              <select value={form.zone} onChange={e => setForm({...form, zone: e.target.value})}
                className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
                <option>İçeri</option>
                <option>Bahçe</option>
                <option>Balkon</option>
                <option>Teras</option>
                <option>Bar</option>
              </select>
            </div>
            <div>
              <label className="text-stone-400 text-xs mb-1 block">Masa No *</label>
              <input type="number" required value={form.number}
                onChange={e => setForm({...form, number: e.target.value})}
                className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="text-stone-400 text-xs mb-1 block">İsim (opsiyonel)</label>
              <input type="text" value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder={`Masa ${form.number || '?'}`}
                className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="text-stone-400 text-xs mb-1 block">Kapasite</label>
              <input type="number" value={form.capacity}
                onChange={e => setForm({...form, capacity: e.target.value})}
                className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="col-span-4 flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-semibold px-5 py-2 rounded-lg text-sm transition">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-stone-400 hover:text-white px-4 py-2 rounded-lg text-sm transition">
                İptal
              </button>
            </div>
          </form>
        )}

        {tables.length === 0 ? (
          <div className="text-center py-20 text-stone-500">
            <div className="text-4xl mb-3">🪑</div>
            <div>Henüz masa eklenmemiş</div>
            <button onClick={() => setShowForm(true)} className="mt-4 text-amber-500 hover:text-amber-400 text-sm">
              İlk masayı ekle →
            </button>
          </div>
        ) : (
          zones.map(zone => (
            <div key={zone} className="mb-8">
              <h2 className="text-stone-400 text-sm font-semibold uppercase tracking-wider mb-3 border-b border-stone-700 pb-2">{zone}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tables.filter(t => t.zone === zone).map(t => (
                  <div key={t.id} className="bg-stone-800 border border-stone-700 rounded-xl p-4 text-center hover:border-stone-500 transition">
                    <div className="text-stone-500 text-xs mb-1">{t.zone}</div>
                    <div className="text-2xl font-bold text-amber-400 mb-1">{t.number}</div>
                    <div className="text-stone-300 text-sm font-medium">{t.name}</div>
                    <div className="text-stone-500 text-xs mt-1">{t.capacity} kişilik</div>
                    <div className="mt-3 flex gap-2 justify-center flex-wrap">
                      <button onClick={() => printQR(t)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition">Yazdır</button>
                      <button onClick={() => downloadQR(t)}
                        className="text-xs text-green-400 hover:text-green-300 transition">İndir</button>
                      <button onClick={() => deleteTable(t.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 transition">Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
