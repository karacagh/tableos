'use client';
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Category { id: number; name: string; sort_order: number; image_url?: string; }
interface Product {
  id: number; category_id: number; name: string; description: string;
  price: number; image_url: string; is_campaign: boolean; campaign_price: number;
}
interface CartItem { product: Product; quantity: number; note: string; }
interface OrderItem { id: number; name: string; quantity: number; unit_price: number; }
interface Order { id: number; status: string; created_at: string; items: OrderItem[]; }
interface Bill { id: number; total: number; status: string; }

const STATUS_LABEL: Record<string, string> = {
  pending: '⏳ Bekliyor',
  preparing: '👨‍🍳 Hazırlanıyor',
  ready: '✅ Hazır — Geliyor!',
  delivered: '🎉 Teslim Edildi',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'text-amber-400',
  preparing: 'text-blue-400',
  ready: 'text-green-400',
  delivered: 'text-stone-400',
};

function MenuContent() {
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table');
  const tableZone = searchParams.get('zone') || 'İçeri';

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tableId, setTableId] = useState<number | null>(null);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [review, setReview] = useState({ product: 0, ambiance: 0, service: 0, note: '' });
  const [reviewSent, setReviewSent] = useState(false);
  const [showCategoryGrid, setShowCategoryGrid] = useState(true);
  const [settings, setSettings] = useState<{ cafe_instagram?: string; cafe_facebook?: string }>({});

  const loadAll = useCallback(async () => {
    try {
      const [cats, prods, tables, camps, sett] = await Promise.all([
        api.get('/api/categories'),
        api.get('/api/products'),
        api.get('/api/tables'),
        api.get('/api/campaigns'),
        api.get('/api/settings').catch(() => ({ data: {} })),
      ]);
      setCategories(cats.data);
      setProducts(prods.data);
      setCampaigns(camps.data);
      setSettings(sett.data || {});
      if (tableNumber) {
        const t = tables.data.find((t: any) => t.number === parseInt(tableNumber));
        if (t) {
          setTableId(t.id);
          loadTableOrders(t.id);
        }
      }
    } catch { toast.error('Menü yüklenemedi'); }
    finally { setLoading(false); }
  }, [tableNumber]);

  async function loadTableOrders(tid: number) {
    try {
      const [ordersRes, activeBillRes] = await Promise.all([
        api.get('/api/orders'),
        api.get('/api/bills/table/' + tid).catch(() => ({ data: null })),
      ]);
      const activeBill = activeBillRes.data;
      const filtered = ordersRes.data.filter((o: any) => {
        if (activeBill) {
          return o.bill_id === activeBill.id ||
            (o.table_id === tid && !['cancelled','delivered'].includes(o.status));
        }
        return o.table_id === tid && !['cancelled','delivered'].includes(o.status);
      });
      setMyOrders(filtered);
      setBill(activeBill || null);
    } catch {}
  }

  useEffect(() => { loadAll(); }, [loadAll]);
  // Otomatik kategori seçimi kaldırıldı — grid üzerinden seçim yapılıyor

  // Siparişleri periyodik güncelle
  useEffect(() => {
    if (!tableId) return;
    const interval = setInterval(() => loadTableOrders(tableId), 15000);
    return () => clearInterval(interval);
  }, [tableId]);

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
  function getCartTotal() {
    return cart.reduce((s, i) => {
      const price = i.product.is_campaign && i.product.campaign_price ? i.product.campaign_price : i.product.price;
      return s + (i.quantity * price);
    }, 0);
  }

  async function placeOrder() {
    if (!tableId) { toast.error('Masa bulunamadı'); return; }
    if (cart.length === 0) { toast.error('Sepet boş'); return; }
    setOrdering(true);
    try {
      const orderData = await api.post('/api/orders', {
        table_id: tableId,
        note: orderNote,
        items: cart.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          note: i.note,
        })),
      });
      setLastOrderId(orderData.data.id);
      setOrdered(true);
      setCart([]);
      setShowCart(false);
      loadTableOrders(tableId);
    } catch { toast.error('Sipariş gönderilemedi, tekrar deneyin'); }
    finally { setOrdering(false); }
  }

  async function submitReview() {
    if (!review.product || !review.ambiance || !review.service) {
      toast.error('Tüm puanları verin'); return;
    }
    try {
      await api.post('/api/reviews', {
        table_id: tableId,
        order_id: lastOrderId,
        rating_product: review.product,
        rating_ambiance: review.ambiance,
        rating_service: review.service,
        note: review.note || null,
      });
      setReviewSent(true);
      toast.success('Değerlendirmeniz için teşekkürler!');
    } catch { toast.error('Gönderim hatası'); }
  }

  const filteredProducts = activeCategory === -1
    ? products.filter(p => p.is_campaign)
    : products.filter(p => p.category_id === activeCategory);
  const campaignProducts = products.filter(p => p.is_campaign);
  const activeOrders = myOrders.filter(o => o.status !== 'delivered');
  const billTotal = myOrders.reduce((s, o) => s + (o.items?.reduce((ss, i) => ss + (i.quantity * i.unit_price), 0) || 0), 0);

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-amber-500 text-lg font-semibold animate-pulse">Menü yükleniyor...</div>
    </div>
  );

  if ((ordered && !showOrders) || showReview || reviewSent) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      <div className="text-center max-w-sm w-full">
        {!showReview && !reviewSent && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Siparişiniz Alındı!</h2>
            <p className="text-stone-400 mb-1">{tableZone} · Masa {tableNumber}</p>
            <p className="text-stone-500 text-sm mb-6">Siparişiniz hazırlanıyor, kısa sürede geliyor.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setOrdered(false); loadAll(); }}
                className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-6 py-3 rounded-xl transition">
                Yeni Sipariş Ver
              </button>
              <button onClick={() => { setShowOrders(true); setOrdered(false); }}
                className="text-stone-400 hover:text-white text-sm transition">
                Siparişlerimi Gör
              </button>
            </div>
          </>
        )}

        {showReview && !reviewSent && (
          <div className="bg-stone-800 rounded-2xl p-6 text-left">
            <h3 className="text-xl font-bold text-white text-center mb-6">Deneyiminizi Değerlendirin</h3>

            {[
              { key: 'product', label: 'Ürünler', emoji: '🍽️' },
              { key: 'ambiance', label: 'Ortam', emoji: '✨' },
              { key: 'service', label: 'Servis', emoji: '👋' },
            ].map(({ key, label, emoji }) => (
              <div key={key} className="mb-5">
                <div className="text-stone-300 text-sm font-medium mb-2">{emoji} {label}</div>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button"
                      onClick={() => setReview(prev => ({ ...prev, [key]: star }))}
                      className={`text-3xl transition ${(review as any)[key] >= star ? 'opacity-100' : 'opacity-25'}`}>
                      ⭐
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="mb-5">
              <div className="text-stone-300 text-sm font-medium mb-2">💬 Notunuz (opsiyonel)</div>
              <textarea value={review.note} onChange={e => setReview({...review, note: e.target.value})}
                placeholder="Deneyiminizi anlatın..."
                rows={3}
                className="w-full bg-stone-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={submitReview}
                disabled={!review.product || !review.ambiance || !review.service}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-stone-900 font-bold rounded-xl transition">
                Gönder
              </button>
              <button onClick={() => { setShowReview(false); }}
                className="px-4 py-3 bg-stone-700 hover:bg-stone-600 rounded-xl text-sm transition">
                Geç
              </button>
            </div>
          </div>
        )}

        {reviewSent && (
          <div>
            <div className="text-6xl mb-4">🙏</div>
            <h2 className="text-2xl font-bold text-white mb-2">Teşekkürler!</h2>
            <p className="text-stone-400 mb-6">Değerlendirmeniz kaydedildi.</p>
            <button onClick={() => { setOrdered(false); setReviewSent(false); setShowReview(false); loadAll(); }}
              className="bg-amber-500 hover:bg-amber-600 text-stone-900 font-semibold px-6 py-3 rounded-xl transition mb-6">
              Yeni Sipariş Ver
            </button>
            {(settings.cafe_instagram || settings.cafe_facebook) && (
              <div className="flex flex-col gap-3 mt-2">
                <div className="text-stone-600 text-xs text-center uppercase tracking-wider">Bizi Takip Et</div>
                {settings.cafe_instagram && (
                  <a href={settings.cafe_instagram} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold px-6 py-3 rounded-xl transition hover:opacity-90 text-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <rect x="2" y="2" width="20" height="20" rx="5"/>
                      <circle cx="12" cy="12" r="4"/>
                      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
                    </svg>
                    Instagram'da Takip Et
                  </a>
                )}
                {settings.cafe_facebook && (
                  <a href={settings.cafe_facebook} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl transition hover:bg-blue-700 text-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                    </svg>
                    Facebook'ta Takip Et
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 text-white pb-28">
      {/* Header */}
      <div className="bg-stone-800 border-b border-stone-700 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {!showCategoryGrid && (
              <button onClick={() => { setShowCategoryGrid(true); setActiveCategory(null); }}
                className="text-stone-400 hover:text-white transition">
                ←
              </button>
            )}
            <h1 className="text-lg font-bold text-amber-500">Monet Cafe</h1>
          </div>
          <div className="flex items-center gap-3">
            {tableNumber && (
              <div className="text-stone-400 text-sm">{tableZone} · Masa {tableNumber}</div>
            )}
            {myOrders.length > 0 && (
              <button onClick={() => setShowOrders(!showOrders)}
                className="relative bg-stone-700 hover:bg-stone-600 px-3 py-1.5 rounded-lg text-xs font-medium transition">
                Siparişlerim
                {activeOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-xs flex items-center justify-center text-stone-900 font-bold">
                    {activeOrders.length}
                  </span>
                )}
              </button>
            )}
            {myOrders.length > 0 && !reviewSent && !showReview && (
              <button
                onClick={() => { setShowReview(true); setShowOrders(false); }}
                className="flex items-center gap-1.5 bg-stone-700 hover:bg-stone-600 px-3 py-1.5 rounded-lg text-xs font-medium transition text-amber-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Değerlendir
              </button>
            )}
            {reviewSent && (
              <span className="text-green-400 text-xs">✓ Teşekkürler</span>
            )}
          </div>
        </div>
        {/* Kategori Tabs — sadece grid kapalıyken göster */}
        {!showCategoryGrid && <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {campaigns.length > 0 && (
            <button onClick={() => setActiveCategory(-2)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${activeCategory === -2 ? 'bg-orange-500 text-white' : 'bg-stone-700 text-stone-300'}`}>
              🎯 Kampanyalar
            </button>
          )}
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
        </div>}
      </div>

      {/* Siparişlerim Panel */}
      {showOrders && (
        <div className="bg-stone-800 border-b border-stone-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-amber-400">Siparişlerim</h3>
            <button onClick={() => setShowOrders(false)} className="text-stone-500 hover:text-white text-lg">×</button>
          </div>
          {myOrders.length === 0 ? (
            <div className="text-stone-500 text-sm text-center py-4">Sipariş bulunamadı</div>
          ) : (
            <div className="space-y-3">
              {myOrders.map(o => {
                const total = o.items?.reduce((s, i) => s + (i.quantity * i.unit_price), 0) || 0;
                return (
                  <div key={o.id} className="bg-stone-700 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm font-semibold ${STATUS_COLOR[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                      <span className="text-amber-400 font-semibold text-sm">₺{total.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {o.items?.map((item, i) => (
                        <span key={i} className="text-xs bg-stone-600 px-2 py-0.5 rounded-full text-stone-300">
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Adisyon özeti */}
              {billTotal > 0 && (
                <div className="border-t border-stone-600 pt-3 flex justify-between items-center">
                  <span className="text-stone-400 text-sm">Toplam Adisyon</span>
                  <span className="text-amber-400 font-bold text-lg">₺{billTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          <button onClick={() => { setShowOrders(false); if (tableId) loadTableOrders(tableId); }}
            className="w-full mt-3 py-2 bg-stone-700 hover:bg-stone-600 rounded-lg text-sm transition">
            Yenile
          </button>
        </div>
      )}

      {/* Kategori Grid */}
      {showCategoryGrid && !showCart && !showOrders && (
        <div className="p-4">
          <div className="flex flex-col gap-3">
            {(() => {
              const rows: React.ReactElement[] = [];
              let i = 0;
              const ratios = [[60,40],[35,65],[55,45],[40,60],[65,35]];
              let ratioIndex = 0;
              while (i < categories.length) {
                if (i === 0) {
                  const cat = categories[i];
                  rows.push(
                    <button key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setShowCategoryGrid(false); }}
                      className="relative overflow-hidden rounded-2xl w-full group"
                      style={{ height: '150px' }}>
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-800" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="font-bold text-white text-xl">{cat.name}</div>
                        <div className="text-white/50 text-xs mt-0.5">{products.filter(p => p.category_id === cat.id).length} ürün</div>
                      </div>
                    </button>
                  );
                  i++;
                } else if (i + 1 < categories.length) {
                  const [r1, r2] = ratios[ratioIndex % ratios.length];
                  ratioIndex++;
                  const cat1 = categories[i];
                  const cat2 = categories[i+1];
                  rows.push(
                    <div key={`row-${i}`} className="flex gap-3" style={{ height: '110px' }}>
                      {[{cat: cat1, pct: r1}, {cat: cat2, pct: r2}].map(({cat, pct}) => (
                        <button key={cat.id}
                          onClick={() => { setActiveCategory(cat.id); setShowCategoryGrid(false); }}
                          className="relative overflow-hidden rounded-2xl group"
                          style={{ width: `${pct}%`, flexShrink: 0 }}>
                          {cat.image_url ? (
                            <img src={cat.image_url} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-800" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <div className="font-bold text-white text-sm leading-tight">{cat.name}</div>
                            <div className="text-white/50 text-xs">{products.filter(p => p.category_id === cat.id).length} ürün</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                  i += 2;
                } else {
                  const cat = categories[i];
                  rows.push(
                    <button key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setShowCategoryGrid(false); }}
                      className="relative overflow-hidden rounded-2xl w-full group"
                      style={{ height: '110px' }}>
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-800" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="font-bold text-white text-lg">{cat.name}</div>
                        <div className="text-white/50 text-xs">{products.filter(p => p.category_id === cat.id).length} ürün</div>
                      </div>
                    </button>
                  );
                  i++;
                }
              }
              return rows;
            })()}
          </div>
        </div>
      )}

      {/* Kampanya Listesi */}
      {!showCategoryGrid && !showCart && !showOrders && activeCategory === -2 && (
        <div className="p-4 space-y-3">
          {campaigns.map(c => {
            const originalTotal = c.products?.reduce((s: number, p: any) => s + Number(p.original_price), 0) || 0;
            return (
              <div key={c.id} className="bg-stone-800 border-2 border-amber-500/40 rounded-xl overflow-hidden">
                {c.image_url && <img src={c.image_url} alt={c.name} className="w-full h-40 object-cover" />}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-white">{c.name}</h3>
                      {c.description && <p className="text-stone-400 text-xs mt-1">{c.description}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-stone-500 text-xs line-through">₺{originalTotal.toFixed(2)}</div>
                      <div className="text-amber-400 text-2xl font-bold">₺{Number(c.campaign_price).toFixed(2)}</div>
                      {originalTotal > Number(c.campaign_price) && (
                        <div className="text-green-400 text-xs">₺{(originalTotal - Number(c.campaign_price)).toFixed(2)} tasarruf!</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {c.products?.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 bg-stone-700 rounded-lg px-2 py-1">
                        {p.image_url && <img src={p.image_url} alt="" className="w-5 h-5 rounded object-cover" />}
                        <span className="text-xs text-stone-300">{p.product_name}</span>
                        <span className="text-stone-500 text-xs line-through">₺{Number(p.original_price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    c.products?.forEach((p: any) => {
                      const product = products.find(pr => pr.id === p.product_id);
                      if (product) addToCart(product);
                    });
                    toast.success('Kampanya sepete eklendi!');
                  }} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold rounded-xl text-sm transition">
                    Kampanyayı Sepete Ekle
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ürün Listesi */}
      {!showCategoryGrid && !showCart && !showOrders && activeCategory !== -2 && (<div className="p-4 space-y-3">
        {filteredProducts.map(p => {
          const cartItem = cart.find(i => i.product.id === p.id);
          const displayPrice = p.is_campaign && p.campaign_price ? p.campaign_price : p.price;
          return (
            <div key={p.id} className="bg-stone-800 border border-stone-700 rounded-xl p-4 flex gap-3">
              {p.image_url && (
                <img src={p.image_url} alt={p.name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
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
                        className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center font-bold hover:bg-stone-600 transition">−</button>
                      <span className="text-amber-400 font-bold w-4 text-center">{cartItem.quantity}</span>
                      <button onClick={() => addToCart(p)}
                        className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-stone-900 font-bold hover:bg-amber-600 transition">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(p)}
                      className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-stone-900 font-bold hover:bg-amber-600 transition">+</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {(settings.cafe_instagram || settings.cafe_facebook) && (
          <div className="mt-6 mb-4 flex flex-col gap-3 px-1">
            <div className="text-stone-600 text-xs text-center uppercase tracking-wider">Bizi Takip Et</div>
            {settings.cafe_instagram && (
              <a href={settings.cafe_instagram} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold px-6 py-3 rounded-xl transition hover:opacity-90 text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="2" width="20" height="20" rx="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
                </svg>
                Instagram'da Takip Et
              </a>
            )}
            {settings.cafe_facebook && (
              <a href={settings.cafe_facebook} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl transition hover:bg-blue-700 text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
                Facebook'ta Takip Et
              </a>
            )}
          </div>
        )}
      </div>)}

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
              {cart.map(item => {
                const price = item.product.is_campaign && item.product.campaign_price ? item.product.campaign_price : item.product.price;
                return (
                  <div key={item.product.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.product.name}</div>
                      <div className="text-amber-400 text-xs">₺{(item.quantity * price).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.product.id)}
                        className="w-7 h-7 rounded-full bg-stone-700 flex items-center justify-center font-bold hover:bg-stone-600">−</button>
                      <span className="text-amber-400 font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => addToCart(item.product)}
                        className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-stone-900 font-bold hover:bg-amber-600">+</button>
                    </div>
                  </div>
                );
              })}
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
    <Suspense fallback={
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div className="text-amber-500 animate-pulse">Yükleniyor...</div>
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}
