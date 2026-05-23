'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

interface Category { id: number; name: string; sort_order: number; }
interface Product {
  id: number; category_id: number; category_name: string;
  name: string; description: string; price: number;
  image_url: string; is_campaign: boolean; campaign_price: number;
}
interface CartItem { product: Product; quantity: number; note: string; }

function MenuContent() {
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table');
  const tableZone = searchParams.get('zone') || 'İçeri';

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tableId, setTableId] = useState<number | null>(null);
  const [settings, setSettings] = useState<any>({});

  const loadAll = useCallback(async () => {
    try {
      const [cats, prods, tables] = await Promise.all([
        api.get('/api/categories'),
        api.get('/api/products'),
        api.get('/api/tables'),
      ]);
      setCategories(cats.data);
      setProducts(prods.data);
      if (tableNumber) {
        const t = tables.data.find((t: any) => t.number === parseInt(tableNumber));
        if (t) setTableId(t.id);
      }
    } catch { toast.error('Menü yüklenemedi'); }
    finally { setLoading(false); }
  }, [tableNumber]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0].id);
  }, [categories]);

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, note: '' }];
    });
    toast.success(`${product.name} eklendi`, { duration: 1000 });
  }

  function removeFromCart(productId: number) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === productId);
      if (existing && existing.quantity > 1) return prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.product.id !== productId);
    });
  }

  function getCartCount() { return cart.reduce((s, i) => s + i.quantity, 0); }
  function getCartTotal() { return cart.reduce((s, i) => s + (i.quantity * (i.product.is_campaign && i.product.campaign_price ? i.product.campaign_price : i.product.price)), 0); }

  async function placeOrder() {
    if (!tableId) { toast.error('Masa bulunamadı'); return; }
    if (cart.length === 0) { toast.error('Sepet boş'); return; }
    setOrdering(true);
    try {
      await api.post('/api/orders', {
        table_id: tableId,
        note: orderNote,
        items: cart.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          note: i.note,
        })),
      });
      setOrdered(true);
      setCart([]);
      setShowCart(false);
    } catch { toast.error('Sipariş gönderilemedi, tekrar deneyin'); }
    finally { setOrdering(false); }
  }

  const filteredProducts = activeCategory ? products.filter(p => p.category_id === activeCategory) : products;
  const campaignProducts = products.filter(p => p.is_campaign);

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-amber-500 text-lg font-semibold animate-pulse">Menü yükleniyor...</div>
    </div>
  );

  if (ordered) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-white mb-2">Siparişiniz Alındı!</h2>
        <p className="text-stone-400 mb-2">{tableZone} - Masa {tableNumber}</p>
        <p className="text-stone-500 text-sm mb-6">Siparişiniz hazırlanıyor, kısa sürede geliyor.</p>
        <button onClick={() => setOrdered(false)}
          className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-6 py-3 rounded-xl transition">
          Yeni Sipariş Ver
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 text-white pb-24">
      {/* Header */}
      <div className="bg-stone-800 border-b border-stone-700 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-amber-500">Monet Cafe</h1>
          {tableNumber && (
            <div className="text-stone-400 text-sm">{tableZone} · Masa {tableNumber}</div>
          )}
        </div>
        {/* Kategori Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mt-3">
          {campaignProducts.length > 0 && (
            <button onClick={() => setActiveCategory(-1)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${activeCategory === -1 ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-stone-300'}`}>
              🔥 Kampanya
            </button>
          )}
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${activeCategory === c.id ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-stone-300'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ürünler */}
      <div className="p-4 space-y-3">
        {(activeCategory === -1 ? campaignProducts : filteredProducts).map(p => {
          const cartItem = cart.find(i => i.product.id === p.id);
          const displayPrice = p.is_campaign && p.campaign_price ? p.campaign_price : p.price;
          return (
            <div key={p.id} className="bg-stone-800 border border-stone-700 rounded-xl p-4 flex gap-3">
              {p.image_url && (
                <img src={p.image_url} alt={p.name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">{p.name}</div>
                    {p.is_campaign && (
                      <span className="bg-amber-500 text-stone-900 text-xs font-bold px-2 py-0.5 rounded-full">KAMPANYA</span>
                    )}
                    {p.description && <div className="text-stone-500 text-xs mt-1 line-clamp-2">{p.description}</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <span className="text-amber-400 font-bold">₺{displayPrice}</span>
                    {p.is_campaign && p.campaign_price && (
                      <span className="text-stone-500 text-xs line-through ml-2">₺{p.price}</span>
                    )}
                  </div>
                  {cartItem ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(p.id)}
                        className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center text-white font-bold transition hover:bg-stone-600">−</button>
                      <span className="text-amber-400 font-bold w-4 text-center">{cartItem.quantity}</span>
                      <button onClick={() => addToCart(p)}
                        className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-stone-900 font-bold transition hover:bg-amber-600">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(p)}
                      className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-stone-900 font-bold transition hover:bg-amber-600">+</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sepet Butonu */}
      {cart.length > 0 && !showCart && (
        <div className="fixed bottom-4 left-4 right-4 z-20">
          <button onClick={() => setShowCart(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold py-4 rounded-xl flex items-center justify-between px-5 shadow-lg transition">
            <span className="bg-stone-900 text-amber-500 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{getCartCount()}</span>
            <span>Sepeti Görüntüle</span>
            <span className="font-bold">₺{getCartTotal().toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Sepet Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/70 z-30 flex items-end">
          <div className="bg-stone-800 w-full rounded-t-2xl p-5 max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Sepetim</h3>
              <button onClick={() => setShowCart(false)} className="text-stone-400 hover:text-white text-2xl">×</button>
            </div>
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.product.name}</div>
                    <div className="text-amber-400 text-xs">₺{(item.quantity * (item.product.is_campaign && item.product.campaign_price ? item.product.campaign_price : item.product.price)).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeFromCart(item.product.id)}
                      className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center font-bold hover:bg-stone-600">−</button>
                    <span className="text-amber-400 font-bold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => addToCart(item.product)}
                      className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-stone-900 font-bold hover:bg-amber-600">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-stone-400 text-xs mb-1 block">Sipariş Notu (opsiyonel)</label>
              <input value={orderNote} onChange={e => setOrderNote(e.target.value)}
                placeholder="Alerji, özel istek..."
                className="w-full bg-stone-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="flex justify-between font-bold text-lg mb-4 border-t border-stone-700 pt-4">
              <span>Toplam</span>
              <span className="text-amber-400">₺{getCartTotal().toFixed(2)}</span>
            </div>
            <button onClick={placeOrder} disabled={ordering}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-bold rounded-xl transition text-lg">
              {ordering ? 'Gönderiliyor...' : `Sipariş Ver · ₺${getCartTotal().toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-900 flex items-center justify-center"><div className="text-amber-500">Yükleniyor...</div></div>}>
      <MenuContent />
    </Suspense>
  );
}
