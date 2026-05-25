'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Settings {
  cafe_name: string;
  cafe_slogan: string;
  cafe_type: string;
  cafe_address: string;
  cafe_phone: string;
  cafe_email: string;
  cafe_instagram: string;
  cafe_facebook: string;
  cafe_whatsapp: string;
  cafe_about: string;
  cafe_career_email: string;
  currency: string;
  cafe_hero_image: string;
  cafe_hero_image_mobile: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    cafe_name: '',
    cafe_slogan: '',
    cafe_type: 'waiter',
    cafe_address: '',
    cafe_phone: '',
    cafe_email: '',
    cafe_instagram: '',
    cafe_facebook: '',
    cafe_whatsapp: '',
    cafe_about: '',
    cafe_career_email: '',
    currency: 'TRY',
    cafe_hero_image: '',
    cafe_hero_image_mobile: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await api.get('/api/settings');
      setSettings(prev => ({ ...prev, ...res.data }));
    } catch { toast.error('Ayarlar yüklenemedi'); }
    finally { setLoading(false); }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/settings', settings);
      toast.success('Ayarlar kaydedildi');
    } catch { toast.error('Kayıt başarısız'); }
    finally { setSaving(false); }
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
          <h1 className="text-lg font-bold text-amber-500">Cafe Ayarları</h1>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        <form onSubmit={saveSettings} className="space-y-6">

          {/* Genel Bilgiler */}
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
            <h2 className="text-stone-300 font-semibold mb-4">Genel Bilgiler</h2>
            <div className="space-y-4">
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Cafe Adı</label>
                <input value={settings.cafe_name} onChange={e => setSettings({...settings, cafe_name: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Slogan</label>
                <input value={settings.cafe_slogan} onChange={e => setSettings({...settings, cafe_slogan: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Çalışma Tipi</label>
                <select value={settings.cafe_type} onChange={e => setSettings({...settings, cafe_type: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="waiter">Garsonlu</option>
                  <option value="self">Self Servis</option>
                </select>
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Ana Sayfa Hero Görseli URL (GIF veya PNG)</label>
                <input value={settings.cafe_hero_image || ''} onChange={e => setSettings({...settings, cafe_hero_image: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                <p className="text-stone-600 text-xs mt-1">GIF desteklenir. Boş bırakılırsa gradient arka plan kullanılır.</p>
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Ana Sayfa Hero Görseli — Mobil (dikey format, GIF veya PNG)</label>
                <input value={settings.cafe_hero_image_mobile || ''}
                  onChange={e => setSettings({...settings, cafe_hero_image_mobile: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                <p className="text-stone-600 text-xs mt-1">Boş bırakılırsa masaüstü görseli kullanılır.</p>
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Hakkımızda</label>
                <textarea value={settings.cafe_about} onChange={e => setSettings({...settings, cafe_about: e.target.value})}
                  rows={3}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
              </div>
            </div>
          </div>

          {/* İletişim */}
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
            <h2 className="text-stone-300 font-semibold mb-4">İletişim Bilgileri</h2>
            <div className="space-y-4">
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Adres</label>
                <input value={settings.cafe_address} onChange={e => setSettings({...settings, cafe_address: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-stone-400 text-xs mb-1 block">Telefon</label>
                  <input value={settings.cafe_phone} onChange={e => setSettings({...settings, cafe_phone: e.target.value})}
                    placeholder="+90 5xx xxx xx xx"
                    className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="text-stone-400 text-xs mb-1 block">E-posta</label>
                  <input value={settings.cafe_email} onChange={e => setSettings({...settings, cafe_email: e.target.value})}
                    className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Kariyer E-posta</label>
                <input value={settings.cafe_career_email} onChange={e => setSettings({...settings, cafe_career_email: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
          </div>

          {/* Sosyal Medya */}
          <div className="bg-stone-800 border border-stone-700 rounded-xl p-5">
            <h2 className="text-stone-300 font-semibold mb-4">Sosyal Medya</h2>
            <div className="space-y-4">
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Instagram URL</label>
                <input value={settings.cafe_instagram} onChange={e => setSettings({...settings, cafe_instagram: e.target.value})}
                  placeholder="https://instagram.com/..."
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Facebook URL</label>
                <input value={settings.cafe_facebook} onChange={e => setSettings({...settings, cafe_facebook: e.target.value})}
                  placeholder="https://facebook.com/..."
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">WhatsApp (numara)</label>
                <input value={settings.cafe_whatsapp} onChange={e => setSettings({...settings, cafe_whatsapp: e.target.value})}
                  placeholder="905xxxxxxxxx"
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-bold rounded-xl transition">
            {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
          </button>
        </form>
      </main>
    </div>
  );
}
