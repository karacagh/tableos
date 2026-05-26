'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Category { id: number; name: string; sort_order: number; image_url?: string; }
interface Product {
  id: number; category_id: number; category_name: string;
  name: string; description: string; price: number;
  image_url: string; is_campaign: boolean; campaign_price: number; is_active: boolean;
}

export default function MenuPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'products'|'categories'|'campaigns'>('products');
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product|null>(null);
  const [editCat, setEditCat] = useState<Category|null>(null);
  const [saving, setSaving] = useState(false);

  const emptyProduct = { category_id: '', name: '', description: '', price: '', image_url: '', is_campaign: false, campaign_price: '' };
  const [productForm, setProductForm] = useState<any>(emptyProduct);
  const [catForm, setCatForm] = useState({ name: '', sort_order: '0', image_url: '' });
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
      const [cats, prods] = await Promise.all([api.get('/api/categories'), api.get('/api/products')]);
      setCategories(cats.data);
      setProducts(prods.data);
    } catch { toast.error('Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...productForm,
        price: parseFloat(productForm.price),
        campaign_price: productForm.campaign_price ? parseFloat(productForm.campaign_price) : null,
        category_id: parseInt(productForm.category_id),
      };
      if (editProduct) {
        await api.put(`/api/products/${editProduct.id}`, { ...data, is_active: true });
        toast.success('Ürün güncellendi');
      } else {
        await api.post('/api/products', data);
        toast.success('Ürün eklendi');
      }
      setProductForm(emptyProduct);
      setShowProductForm(false);
      setEditProduct(null);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Hata oluştu');
    } finally { setSaving(false); }
  }

  async function deleteProduct(id: number) {
    if (!confirm('Bu ürünü silmek istiyor musunuz?')) return;
    try {
      await api.delete(`/api/products/${id}`);
      toast.success('Ürün silindi');
      loadAll();
    } catch { toast.error('Hata oluştu'); }
  }

  async function saveCat(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/categories', { name: catForm.name, sort_order: parseInt(catForm.sort_order), image_url: catForm.image_url || null });
      toast.success('Kategori eklendi');
      setCatForm({ name: '', sort_order: '0', image_url: '' });
      setShowCatForm(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Hata oluştu');
    } finally { setSaving(false); }
  }

  async function updateCat(e: React.FormEvent) {
    e.preventDefault();
    if (!editCat) return;
    setSaving(true);
    try {
      await api.put(`/api/categories/${editCat.id}`, {
        name: editCat.name,
        sort_order: editCat.sort_order,
        is_active: true,
        image_url: editCat.image_url || null,
      });
      toast.success('Kategori güncellendi');
      setEditCat(null);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Hata oluştu');
    } finally { setSaving(false); }
  }

  async function deleteCat(id: number) {
    if (!confirm('Bu kategoriyi silmek istiyor musunuz?')) return;
    try {
      await api.delete(`/api/categories/${id}`);
      toast.success('Kategori silindi');
      loadAll();
    } catch { toast.error('Hata oluştu'); }
  }

  function startEdit(p: Product) {
    setEditProduct(p);
    setProductForm({
      category_id: p.category_id,
      name: p.name,
      description: p.description || '',
      price: p.price,
      image_url: p.image_url || '',
      is_campaign: p.is_campaign,
      campaign_price: p.campaign_price || '',
    });
    setShowProductForm(true);
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
          <h1 className="text-lg font-bold text-amber-500">Menü Yönetimi</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-stone-400 text-sm">{user?.name}</span>
            <button onClick={logout}
              className="text-stone-500 hover:text-white text-sm transition border border-stone-700 hover:border-stone-500 px-3 py-1 rounded-lg">
              Çıkış
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowCatForm(!showCatForm); setShowProductForm(false); }}
              className="bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded-lg text-sm transition">
              + Kategori
            </button>
            <button onClick={() => { setShowProductForm(!showProductForm); setShowCatForm(false); setEditProduct(null); setProductForm(emptyProduct); }}
              className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
              + Ürün
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Kategori Formu */}
        {showCatForm && (
          <form onSubmit={saveCat} className="bg-stone-800 border border-stone-700 rounded-xl p-5 mb-6">
            <div className="flex gap-4 items-end mb-4">
              <div className="flex-1">
                <label className="text-stone-400 text-xs mb-1 block">Kategori Adı *</label>
                <input required value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="w-28">
                <label className="text-stone-400 text-xs mb-1 block">Sıra</label>
                <input type="number" value={catForm.sort_order} onChange={e => setCatForm({...catForm, sort_order: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <button type="submit" disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-semibold px-5 py-2 rounded-lg text-sm transition">
                Kaydet
              </button>
              <button type="button" onClick={() => setShowCatForm(false)}
                className="text-stone-400 hover:text-white px-3 py-2 rounded-lg text-sm transition">İptal</button>
            </div>
            <div>
              <label className="text-stone-400 text-xs mb-1 block">Kategori Görseli URL (GIF veya PNG)</label>
              <input value={catForm.image_url || ''} onChange={e => setCatForm({...catForm, image_url: e.target.value})}
                placeholder="https://..."
                className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </form>
        )}

        {/* Kategori Düzenleme Modalı */}
        {editCat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <form onSubmit={updateCat} className="bg-stone-800 border border-stone-600 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <h3 className="text-amber-400 font-semibold mb-4">Kategori Düzenle</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-stone-400 text-xs mb-1 block">Kategori Adı *</label>
                  <input required value={editCat.name} onChange={e => setEditCat({...editCat, name: e.target.value})}
                    className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="text-stone-400 text-xs mb-1 block">Sıra</label>
                  <input type="number" value={editCat.sort_order} onChange={e => setEditCat({...editCat, sort_order: parseInt(e.target.value)})}
                    className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="text-stone-400 text-xs mb-1 block">Kategori Görseli URL (GIF veya PNG)</label>
                  <input value={editCat.image_url || ''} onChange={e => setEditCat({...editCat, image_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button type="submit" disabled={saving}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-semibold px-6 py-2 rounded-lg text-sm transition">
                  {saving ? 'Kaydediliyor...' : 'Güncelle'}
                </button>
                <button type="button" onClick={() => setEditCat(null)}
                  className="text-stone-400 hover:text-white px-4 py-2 rounded-lg text-sm transition">İptal</button>
              </div>
            </form>
          </div>
        )}

        {/* Ürün Formu */}
        {showProductForm && (
          <form onSubmit={saveProduct} className="bg-stone-800 border border-amber-500/30 rounded-xl p-5 mb-6">
            <h3 className="text-amber-400 font-semibold mb-4">{editProduct ? 'Ürün Düzenle' : 'Yeni Ürün'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Kategori *</label>
                <select required value={productForm.category_id} onChange={e => setProductForm({...productForm, category_id: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">Seçin</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Ürün Adı *</label>
                <input required value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Fiyat (₺) *</label>
                <input required type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="col-span-2">
                <label className="text-stone-400 text-xs mb-1 block">Açıklama</label>
                <input value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="text-stone-400 text-xs mb-1 block">Görsel URL</label>
                <input value={productForm.image_url} onChange={e => setProductForm({...productForm, image_url: e.target.value})}
                  className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex items-center gap-3 mt-4">
                <input type="checkbox" id="campaign" checked={productForm.is_campaign}
                  onChange={e => setProductForm({...productForm, is_campaign: e.target.checked})}
                  className="w-4 h-4 accent-amber-500" />
                <label htmlFor="campaign" className="text-stone-300 text-sm">Kampanyalı ürün</label>
              </div>
              {productForm.is_campaign && (
                <div>
                  <label className="text-stone-400 text-xs mb-1 block">Kampanya Fiyatı (₺)</label>
                  <input type="number" step="0.01" value={productForm.campaign_price}
                    onChange={e => setProductForm({...productForm, campaign_price: e.target.value})}
                    className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button type="submit" disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-semibold px-6 py-2 rounded-lg text-sm transition">
                {saving ? 'Kaydediliyor...' : editProduct ? 'Güncelle' : 'Kaydet'}
              </button>
              <button type="button" onClick={() => { setShowProductForm(false); setEditProduct(null); setProductForm(emptyProduct); }}
                className="text-stone-400 hover:text-white px-4 py-2 rounded-lg text-sm transition">İptal</button>
            </div>
          </form>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-800 rounded-lg p-1 w-fit mb-6">
          {(['products','categories'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === tab ? 'bg-amber-500 text-stone-900' : 'text-stone-400 hover:text-white'}`}>
              {tab === 'products' ? `Ürünler (${products.length})` : `Kategoriler (${categories.length})`}
            </button>
          ))}
          <button key="campaigns" onClick={() => setActiveTab('campaigns')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'campaigns' ? 'bg-amber-500 text-stone-900' : 'text-stone-400 hover:text-white'}`}>
            Kampanyalar
          </button>
        </div>

        {/* Ürün Listesi */}
        {activeTab === 'products' && (
          <div className="space-y-2">
            {products.length === 0 ? (
              <div className="text-center py-20 text-stone-500">
                <div className="text-4xl mb-3">🍽️</div>
                <div>Henüz ürün eklenmemiş</div>
              </div>
            ) : (
              categories.map(cat => {
                const catProducts = products.filter(p => p.category_id === cat.id);
                if (catProducts.length === 0) return null;
                return (
                  <div key={cat.id} className="mb-6">
                    <h2 className="text-stone-400 text-sm font-semibold uppercase tracking-wider mb-3 border-b border-stone-700 pb-2">
                      {cat.name}
                    </h2>
                    <div className="space-y-2">
                      {catProducts.map(p => (
                        <div key={p.id} className="bg-stone-800 border border-stone-700 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-stone-500 transition">
                          {p.image_url && <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{p.name}</span>
                              {p.is_campaign && <span className="bg-amber-500 text-stone-900 text-xs font-bold px-2 py-0.5 rounded-full">KAMPANYA</span>}
                            </div>
                            {p.description && <div className="text-stone-500 text-xs mt-0.5 truncate">{p.description}</div>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            {p.is_campaign && p.campaign_price ? (
                              <div>
                                <div className="text-amber-400 font-bold">₺{p.campaign_price}</div>
                                <div className="text-stone-500 text-xs line-through">₺{p.price}</div>
                              </div>
                            ) : (
                              <div className="text-amber-400 font-bold">₺{p.price}</div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => startEdit(p)}
                              className="text-blue-400 hover:text-blue-300 text-sm transition">Düzenle</button>
                            <button onClick={() => deleteProduct(p.id)}
                              className="text-rose-400 hover:text-rose-300 text-sm transition">Sil</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Kategori Listesi */}
        {activeTab === 'categories' && (
          <div className="space-y-2">
            {categories.length === 0 ? (
              <div className="text-center py-20 text-stone-500">
                <div className="text-4xl mb-3">📂</div>
                <div>Henüz kategori eklenmemiş</div>
              </div>
            ) : (
              categories.map(c => (
                <div key={c.id} className="bg-stone-800 border border-stone-700 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-stone-500 transition">
                  {c.image_url && <img src={c.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                  <div className="flex-1">
                    <div className="font-medium text-white">{c.name}</div>
                    <div className="text-stone-500 text-xs mt-0.5">Sıra: {c.sort_order}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setEditCat(c)}
                      className="text-blue-400 hover:text-blue-300 text-sm transition">Düzenle</button>
                    <button onClick={() => deleteCat(c.id)}
                      className="text-rose-400 hover:text-rose-300 text-sm transition">Sil</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
