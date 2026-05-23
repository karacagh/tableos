'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Table {
  id: number;
  number: number;
  name: string;
  capacity: number;
  is_active: boolean;
  qr_code: string;
}

export default function TablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ number: '', name: '', capacity: '4' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    loadTables();
  }, []);

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
      });
      toast.success('Masa eklendi');
      setForm({ number: '', name: '', capacity: '4' });
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

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-stone-400 hover:text-white transition text-sm">← Geri</a>
          <h1 className="text-lg font-bold text-amber-500">Masa Yönetimi</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
          + Yeni Masa
        </button>
      </header>

      <main className="p-6">
        {showForm && (
          <form onSubmit={addTable} className="bg-stone-800 border border-stone-700 rounded-xl p-5 mb-6 grid grid-cols-3 gap-4">
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
            <div className="col-span-3 flex gap-3">
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tables.map(t => (
              <div key={t.id} className="bg-stone-800 border border-stone-700 rounded-xl p-4 text-center hover:border-stone-500 transition">
                <div className="text-2xl font-bold text-amber-400 mb-1">{t.number}</div>
                <div className="text-stone-300 text-sm font-medium">{t.name}</div>
                <div className="text-stone-500 text-xs mt-1">{t.capacity} kişilik</div>
                <div className="mt-3 flex gap-2 justify-center">
                  <a href={t.qr_code} target="_blank"
                    className="text-xs text-blue-400 hover:text-blue-300 transition">QR</a>
                  <button onClick={() => deleteTable(t.id)}
                    className="text-xs text-rose-400 hover:text-rose-300 transition">Sil</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
