'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Product { id: number; name: string; price: number; category_name: string; image_url: string; }
interface CampaignProduct { product_id: number; product_name: string; original_price: number; image_url: string; }
interface Campaign {
  id: number; name: string; description: string; campaign_price: number;
  image_url: string; is_active: boolean; products: CampaignProduct[];
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    campaign_price: '',
    image_url: '',
    product_ids: [] as number[],
  });
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || !['admin','manager'].includes(u.role)) { router.replace('/login'); return; }
    setUser(u);
    loadAll();
  }, []);

  function logout() { clearAuth(); router.replace('/login'); }

  async function loadAll() {
    try {
      const [camps, prods] = await Promise.all([
        api.get('/api/campaigns'),
        api.get('/api/products'),
      ]);
      setCampaigns(camps.data);
      setProducts(prods.data);
    } catch { toast.error('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }

  function toggleProduct(id: number) {
    setForm(prev => ({
      ...prev,
      product_ids: prev.product_ids.includes(id)
        ? prev.product_ids.filter(p => p !== id)
        : [...prev.product_ids, id]
    }));
  }

  function getOriginalTotal(): number {
    return form.product_ids.reduce((s, id) => {
      const p = products.find(p => p.id === id);
      return s + (p?.price || 0);
    }, 0);
  }

  function getSavings(): number {
    const original = getOriginalTotal();
    const campaign = parseFloat(form.campaign_price) || 0;
    return original - campaign;
  }

  async function saveCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (form.product_ids.length === 0) { toast.error('En az 1 ürün seçin'); return; }
    setSaving(true);
    try {
      const data = { ...form, campaign_price: parseFloat(form.campaign_price) };
      if (editCampaign) {
        await api.put(`/api/campaigns/${editCampaign.id}`, { ...data, is_active: true });
        toast.success('Kampanya güncellendi');
      } else {
        await api.post('/api/campaigns', data);
        toast.success('Kampanya oluşturuldu');
      }
      setShowForm(false);
      setEditCampaign(null);
      setForm({ name: '', description: '', campaign_price: '', image_url: '', product_ids: [] });
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Hata');
    } finally { setSaving(false); }
  }

  async function deleteCampaign(id: number) {
    if (!confirm('Bu kampanyayı silmek istiyor musunuz?')) return;
    try {
      await api.delete(`/api/campaigns/${id}`);
      toast.success('Kampanya silindi');
      loadAll();
    } catch { toast.error('Hata'); }
  }

  function startEdit(c: Campaign) {
    setEditCampaign(c);
    setForm({
      name: c.name,
      description: c.description || '',
      campaign_price: c.campaign_price.toString(),
      image_url: c.image_url || '',
      product_ids: c.products?.map(p => p.product_id) || [],
    });
    setShowForm(true);
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-stone-400">Yükleniyor...</div>
    </div>
  );

  const originalTotal = getOriginalTotal();
  const savings = getSavings();

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-stone-400 hover:text-white transition text-sm">← Geri</a>
          <h1 className="text-lg font-bold text-amber-500">Kampanya Yönetimi</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-stone-400 text-sm">{user?.name}</span>
            <button onClick={logout}
              className="text-stone-500 hover:text-white text-sm transition border border-stone-700 hover:border-stone-500 px-3 py-1 rounded-lg">
              Çıkış
            </button>
          </div>
          <button onClick={() => { setShowForm(!showForm); setEditCampaign(null); setForm({ name: '', description: '', campaign_price: '', image_url: '', product_ids: [] }); }}
            className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
            + Yeni Kampanya
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {showForm && (
          <form onSubmit={saveCampaign} className="bg-stone-800 border border-amber-500/30 rounded-xl p-6 mb-8">
            <h3 className="text-amber-400 font-semibold mb-5">{editCampaign ? 'Kampanya Düzenle' : 'Yeni Kampanya'}</h3>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Kampanya Adı *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Örn: Latte + Cheesecake"
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Kampanya Fiyatı (₺) *</label>
                <input required type="number" step="0.01" value={form.campaign_price}
                  onChange={e => setForm({...form, campaign_price: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="col-span-2">
                <label className="text-stone-400 text-xs mb-1 block">Açıklama</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Kampanya açıklaması..."
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="col-span-2">
                <label className="text-stone-400 text-xs mb-1 block">Görsel URL (opsiyonel)</label>
                <input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>

            {/* Fiyat Özeti */}
            {form.product_ids.length > 0 && form.campaign_price && (
              <div className="bg-stone-900 rounded-xl p-4 mb-5 flex items-center gap-6">
                <div className="text-center">
                  <div className="text-stone-400 text-xs">Normal Fiyat</div>
                  <div className="text-stone-300 text-lg line-through">₺{originalTotal.toFixed(2)}</div>
                </div>
                <div className="text-amber-500 text-2xl">→</div>
                <div className="text-center">
                  <div className="text-stone-400 text-xs">Kampanya Fiyatı</div>
                  <div className="text-amber-400 text-2xl font-bold">₺{parseFloat(form.campaign_price || '0').toFixed(2)}</div>
                </div>
                {savings > 0 && (
                  <div className="text-center ml-4">
                    <div className="text-stone-400 text-xs">Tasarruf</div>
                    <div className="text-green-400 text-lg font-bold">₺{savings.toFixed(2)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Ürün Seçimi */}
            <div className="mb-5">
              <label className="text-stone-400 text-xs mb-2 block">Kampanyaya Eklenecek Ürünler *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-auto">
                {products.map(p => {
                  const isSelected = form.product_ids.includes(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                      className={`text-left p-3 rounded-lg border transition ${isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-stone-600 bg-stone-700 hover:border-stone-500'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-stone-500'}`}>
                          {isSelected && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate">{p.name}</div>
                          <div className="text-amber-400 text-xs">₺{p.price}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-semibold px-6 py-2 rounded-lg text-sm transition">
                {saving ? 'Kaydediliyor...' : editCampaign ? 'Güncelle' : 'Kampanya Oluştur'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditCampaign(null); }}
                className="text-stone-400 hover:text-white px-4 py-2 rounded-lg text-sm transition">İptal</button>
            </div>
          </form>
        )}

        {/* Kampanya Listesi */}
        {campaigns.length === 0 && !showForm ? (
          <div className="text-center py-20 text-stone-500">
            <div className="text-4xl mb-3">🎯</div>
            <div>Henüz kampanya oluşturulmamış</div>
            <button onClick={() => setShowForm(true)} className="mt-4 text-amber-500 hover:text-amber-400 text-sm">
              İlk kampanyayı oluştur →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map(c => {
              const originalTotal = c.products?.reduce((s, p) => s + Number(p.original_price), 0) || 0;
              const savings = originalTotal - Number(c.campaign_price);
              return (
                <div key={c.id} className="bg-stone-800 border border-amber-500/20 rounded-xl overflow-hidden">
                  {c.image_url && (
                    <img src={c.image_url} alt={c.name} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-white text-lg">{c.name}</h3>
                        {c.description && <p className="text-stone-400 text-sm mt-1">{c.description}</p>}
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-stone-400 text-xs line-through">₺{originalTotal.toFixed(2)}</div>
                        <div className="text-amber-400 text-2xl font-bold">₺{Number(c.campaign_price).toFixed(2)}</div>
                        {savings > 0 && <div className="text-green-400 text-xs">₺{savings.toFixed(2)} tasarruf</div>}
                      </div>
                    </div>

                    {/* Ürün Listesi */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {c.products?.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 bg-stone-700 rounded-lg px-3 py-1.5">
                          {p.image_url && <img src={p.image_url} alt="" className="w-6 h-6 rounded object-cover" />}
                          <span className="text-xs text-stone-300">{p.product_name}</span>
                          <span className="text-stone-500 text-xs line-through">₺{Number(p.original_price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => startEdit(c)}
                        className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 rounded-lg text-sm transition">Düzenle</button>
                      <button onClick={() => deleteCampaign(c.id)}
                        className="px-4 py-2 text-rose-400 hover:text-rose-300 text-sm transition">Sil</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
