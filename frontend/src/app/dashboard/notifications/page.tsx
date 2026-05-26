'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface User { id: number; name: string; role: string; }
interface Notification {
  id: number; sender_name: string; sender_role: string;
  message: string; type: string; target_role: string;
  is_read: boolean; is_resolved: boolean; created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Süper Admin', manager: 'Yönetici',
  waiter: 'Garson', cashier: 'Kasiyer', kitchen: 'Mutfak'
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ message: '', target_role: 'all', target_user_id: '', type: 'info' });
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    setCurrentUser(u as User);
    loadAll();
  }, []);

  function logout() { clearAuth(); router.replace('/login'); }

  async function loadAll() {
    setLoading(true);
    try {
      const [notifsRes, usersRes] = await Promise.all([
        api.get('/api/notifications'),
        api.get('/api/users'),
      ]);
      setNotifications(notifsRes.data);
      setUsers(usersRes.data.filter((u: User) => u.role !== 'admin'));
    } catch { toast.error('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }

  async function sendNotification(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/api/notifications', {
        message: form.message,
        target_role: form.target_role,
        type: form.type,
      });
      toast.success('Bildirim gönderildi');
      setForm({ message: '', target_role: 'all', target_user_id: '', type: 'info' });
      setShowForm(false);
      loadAll();
    } catch { toast.error('Hata'); }
    finally { setSending(false); }
  }

  async function markRead(id: number) {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      loadAll();
    } catch {}
  }

  async function markAllRead() {
    try {
      await Promise.all(
        notifications.filter(n => !n.is_read).map(n => api.patch(`/api/notifications/${n.id}/read`))
      );
      toast.success('Tümü okundu işaretlendi');
      loadAll();
    } catch { toast.error('Hata'); }
  }

  const filtered = filter === 'all' ? notifications :
    filter === 'unread' ? notifications.filter(n => !n.is_read) :
    notifications.filter(n => n.target_role === filter);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const TYPE_COLOR: Record<string, string> = {
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    request: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  const TYPE_LABEL: Record<string, string> = {
    info: 'Bilgi', warning: 'Uyarı', request: 'Talep'
  };

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
          <h1 className="text-lg font-bold text-amber-500">Bildirim Merkezi</h1>
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="bg-stone-700 hover:bg-stone-600 px-3 py-2 rounded-lg text-sm transition">
              Tümünü Okundu İşaretle
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)}
            className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
            + Bildirim Gönder
          </button>
          <span className="text-stone-400 text-sm">{currentUser?.name}</span>
          <button onClick={logout}
            className="text-stone-500 hover:text-white text-sm transition border border-stone-700 hover:border-stone-500 px-3 py-1 rounded-lg">
            Çıkış
          </button>
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto">
        {/* Bildirim Gönderme Formu */}
        {showForm && (
          <form onSubmit={sendNotification} className="bg-stone-800 border border-amber-500/30 rounded-xl p-5 mb-6">
            <h3 className="text-amber-400 font-semibold mb-4">Yeni Bildirim Gönder</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Hedef</label>
                <select value={form.target_role} onChange={e => setForm({...form, target_role: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="all">Tüm Personel</option>
                  <option value="waiter">Tüm Garsonlar</option>
                  <option value="cashier">Tüm Kasiyerler</option>
                  <option value="kitchen">Tüm Mutfak</option>
                  <option value="manager">Yöneticiler</option>
                </select>
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Bildirim Tipi</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="info">Bilgi</option>
                  <option value="warning">Uyarı</option>
                  <option value="request">Talep</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-stone-400 text-xs mb-1 block">Mesaj *</label>
              <textarea required value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                placeholder="Mesajınızı yazın..."
                rows={3}
                className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
            </div>

            {/* Hızlı Mesaj Şablonları */}
            <div className="mb-4">
              <div className="text-stone-400 text-xs mb-2">Hızlı Şablonlar:</div>
              <div className="flex flex-wrap gap-2">
                {[
                  'Mutfak kapanıyor, yeni sipariş almayın',
                  'Servis hızlandırın, yoğun dönem',
                  'Temizlik yapılacak, masaları boşaltın',
                  'Toplantı var, 5 dakika sonra kasaya gelin',
                  'Stok sayımı yapılacak',
                ].map(template => (
                  <button key={template} type="button"
                    onClick={() => setForm({...form, message: template})}
                    className="text-xs bg-stone-700 hover:bg-stone-600 px-3 py-1.5 rounded-full transition text-stone-300">
                    {template}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={sending}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-semibold px-6 py-2 rounded-lg text-sm transition">
                {sending ? 'Gönderiliyor...' : 'Gönder'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-stone-400 hover:text-white px-4 py-2 rounded-lg text-sm transition">İptal</button>
            </div>
          </form>
        )}

        {/* Filtreler */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { key: 'all', label: `Tümü (${notifications.length})` },
            { key: 'unread', label: `Okunmamış (${unreadCount})` },
            { key: 'waiter', label: 'Garsonlar' },
            { key: 'cashier', label: 'Kasa' },
            { key: 'kitchen', label: 'Mutfak' },
            { key: 'manager', label: 'Yönetici' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === f.key ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-stone-400 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Bildirim Listesi */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-stone-500">
            <div className="text-4xl mb-3">🔔</div>
            <div>Bildirim bulunamadı</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(n => (
              <div key={n.id} className={`bg-stone-800 border rounded-xl px-5 py-4 flex items-start gap-4 transition ${!n.is_read ? 'border-amber-500/30' : 'border-stone-700'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-amber-400 text-sm">{n.sender_name}</span>
                    <span className="text-stone-600 text-xs">→</span>
                    <span className="text-stone-400 text-xs">{ROLE_LABEL[n.target_role] || n.target_role}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLOR[n.type] || TYPE_COLOR.info}`}>
                      {TYPE_LABEL[n.type] || n.type}
                    </span>
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0"></span>
                    )}
                  </div>
                  <div className="text-stone-200 text-sm">{n.message}</div>
                  <div className="text-stone-600 text-xs mt-1">
                    {new Date(n.created_at).toLocaleString('tr-TR', {day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)}
                    className="text-stone-500 hover:text-white text-xs flex-shrink-0 transition">✓ Okundu</button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
