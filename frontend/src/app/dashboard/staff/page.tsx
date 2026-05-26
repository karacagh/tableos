'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Staff {
  id: number; name: string; email: string;
  role: string; is_active: boolean; created_at: string;
}

const ROLES: Record<string, string> = {
  admin: 'Süper Admin',
  manager: 'Yönetici',
  waiter: 'Garson',
  cashier: 'Kasiyer',
  kitchen: 'Mutfak',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-500/20 text-purple-400',
  manager: 'bg-amber-500/20 text-amber-400',
  waiter: 'bg-blue-500/20 text-blue-400',
  cashier: 'bg-green-500/20 text-green-400',
  kitchen: 'bg-rose-500/20 text-rose-400',
};

export default function StaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'waiter' });
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadStaff();
  }, []);

  function logout() { clearAuth(); router.replace('/login'); }

  async function loadStaff() {
    try {
      const res = await api.get('/api/users');
      setStaff(res.data);
    } catch { toast.error('Personel listesi yüklenemedi'); }
    finally { setLoading(false); }
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/users', form);
      toast.success('Personel eklendi');
      setForm({ name: '', email: '', password: '', role: 'waiter' });
      setShowForm(false);
      loadStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Hata oluştu');
    } finally { setSaving(false); }
  }

  async function toggleActive(s: Staff) {
    try {
      await api.put(`/api/users/${s.id}`, { name: s.name, role: s.role, is_active: !s.is_active });
      toast.success(s.is_active ? 'Personel pasife alındı' : 'Personel aktif edildi');
      loadStaff();
    } catch { toast.error('Hata oluştu'); }
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  const activeStaff = staff.filter(s => s.is_active);
  const passiveStaff = staff.filter(s => !s.is_active);

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-stone-400 hover:text-white transition text-sm">← Geri</a>
          <h1 className="text-lg font-bold text-amber-500">Personel Yönetimi</h1>
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
            + Personel Ekle
          </button>
        </div>
      </header>

      <main className="p-6">
        {showForm && (
          <form onSubmit={addStaff} className="bg-stone-800 border border-amber-500/30 rounded-xl p-5 mb-6">
            <h3 className="text-amber-400 font-semibold mb-4">Yeni Personel</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Ad Soyad *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">E-posta *</label>
                <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Şifre *</label>
                <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Rol *</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="waiter">Garson</option>
                  <option value="cashier">Kasiyer</option>
                  <option value="kitchen">Mutfak</option>
                  <option value="manager">Yönetici</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="submit" disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-semibold px-6 py-2 rounded-lg text-sm transition">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-stone-400 hover:text-white px-4 py-2 rounded-lg text-sm transition">İptal</button>
            </div>
          </form>
        )}

        {/* Aktif Personel */}
        <div className="mb-8">
          <h2 className="text-stone-400 text-sm font-semibold uppercase tracking-wider mb-3 border-b border-stone-700 pb-2">
            Aktif Personel ({activeStaff.length})
          </h2>
          <div className="space-y-2">
            {activeStaff.map(s => (
              <div key={s.id} className="bg-stone-800 border border-stone-700 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-stone-500 transition">
                <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center text-amber-400 font-bold text-sm flex-shrink-0">
                  {s.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">{s.name}</div>
                  <div className="text-stone-500 text-xs mt-0.5">{s.email}</div>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${ROLE_COLORS[s.role]}`}>
                  {ROLES[s.role]}
                </span>
                <button onClick={() => toggleActive(s)}
                  className="text-stone-500 hover:text-rose-400 text-sm transition ml-2">
                  Pasife Al
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Pasif Personel */}
        {passiveStaff.length > 0 && (
          <div>
            <h2 className="text-stone-400 text-sm font-semibold uppercase tracking-wider mb-3 border-b border-stone-700 pb-2">
              Pasif Personel ({passiveStaff.length})
            </h2>
            <div className="space-y-2">
              {passiveStaff.map(s => (
                <div key={s.id} className="bg-stone-800/50 border border-stone-700/50 rounded-xl px-5 py-4 flex items-center gap-4 opacity-60">
                  <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center text-stone-500 font-bold text-sm flex-shrink-0">
                    {s.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-400">{s.name}</div>
                    <div className="text-stone-600 text-xs mt-0.5">{s.email}</div>
                  </div>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-stone-700 text-stone-500">
                    {ROLES[s.role]}
                  </span>
                  <button onClick={() => toggleActive(s)}
                    className="text-stone-500 hover:text-green-400 text-sm transition ml-2">
                    Aktif Et
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
