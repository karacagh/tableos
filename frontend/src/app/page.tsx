'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Category { id: number; name: string; sort_order: number; image_url?: string; }
interface Product {
  id: number; category_id: number; name: string; description: string;
  price: number; image_url: string; is_campaign: boolean; campaign_price: number;
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [cats, prods, settingsRes] = await Promise.all([
          api.get('/api/categories'),
          api.get('/api/products'),
          api.get('/api/settings'),
        ]);
        setCategories(cats.data);
        setProducts(prods.data);
        setSettings(settingsRes.data);
        if (cats.data.length > 0) setActiveCategory(cats.data[0].id);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  const cafeName = settings.cafe_name || 'Monet Cafe';
  const cafeSlogan = settings.cafe_slogan || 'Çikolata Daima İyi Bir Fikirdir.';
  const cafeInstagram = settings.cafe_instagram || '#';
  const cafeFacebook = settings.cafe_facebook || '#';
  const cafeWhatsapp = settings.cafe_whatsapp ? `https://wa.me/${settings.cafe_whatsapp}` : '#';
  const cafeAbout = settings.cafe_about || '';
  const cafeAddress = settings.cafe_address || '';
  const cafePhone = settings.cafe_phone || '';
  const cafeEmail = settings.cafe_email || '';
  const cafeCareerEmail = settings.cafe_career_email || '';
  const heroImage = settings.cafe_hero_image || '';
  const heroImageMobile = settings.cafe_hero_image_mobile || '';

  const filteredProducts = activeCategory ? products.filter(p => p.category_id === activeCategory) : [];

  if (loading) return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center">
      <div className="text-amber-500 animate-pulse text-lg font-semibold">Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 text-white">

      {/* HERO */}
      <div className="relative w-full flex flex-col justify-end overflow-hidden" style={{minHeight: '100svh'}}>
        {/* Arka plan görseli */}
        {heroImage ? (
          <>
            {/* Masaüstü görseli */}
            <img
              src={heroImage}
              alt={cafeName}
              className="absolute inset-0 w-full h-full object-cover object-center hidden md:block"
            />
            {/* Mobil görseli */}
            <img
              src={heroImageMobile || heroImage}
              alt={cafeName}
              className="absolute inset-0 w-full h-full object-cover object-center block md:hidden"
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-stone-800 via-stone-900 to-stone-950" />
        )}
        {/* Karartma overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        {/* İçerik */}
        <div className="relative z-10 px-6 pb-12 pt-20">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-3" style={{fontFamily:'Georgia,serif'}}>
              {cafeName}
            </h1>
            <p className="text-white/60 text-lg italic">{cafeSlogan}</p>
          </div>

          {/* Sosyal Medya */}
          <div className="flex justify-center gap-5 mb-8">
            {cafeInstagram !== '#' && (
              <a href={cafeInstagram} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full transition text-sm text-white/80">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
                </svg>
                Instagram
              </a>
            )}
            {cafeFacebook !== '#' && (
              <a href={cafeFacebook} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full transition text-sm text-white/80">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
                Facebook
              </a>
            )}
            {settings.cafe_whatsapp && (
              <a href={cafeWhatsapp} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full transition text-sm text-white/80">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
                WhatsApp
              </a>
            )}
          </div>

          {/* Menü Butonu */}
          <button onClick={() => setShowMenu(true)}
            className="w-full max-w-sm mx-auto block bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold py-4 rounded-2xl text-lg transition shadow-lg">
            Menüyü Görüntüle
          </button>
        </div>
      </div>

      {/* KATEGORİ GRID MENÜ */}
      {!showMenu && (
        <div className="px-4 py-8">
          <h2 className="text-2xl font-bold text-center text-white mb-6" style={{fontFamily:'Georgia,serif'}}>
            Menümüz
          </h2>
          <div className="flex flex-col gap-3">
            {(() => {
              const rows: JSX.Element[] = [];
              let i = 0;
              const ratios = [
                [60, 40],
                [35, 65],
                [55, 45],
                [40, 60],
                [65, 35],
              ];
              let ratioIndex = 0;

              while (i < categories.length) {
                if (i === 0) {
                  // İlk kategori — tam genişlik
                  const cat = categories[i];
                  rows.push(
                    <button key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setShowMenu(true); }}
                      className="relative overflow-hidden rounded-2xl w-full group"
                      style={{ height: '160px' }}>
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-800" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="font-bold text-white text-xl">{cat.name}</div>
                        <div className="text-white/50 text-xs mt-0.5">
                          {products.filter(p => p.category_id === cat.id).length} ürün
                        </div>
                      </div>
                    </button>
                  );
                  i++;
                } else if (i + 1 < categories.length) {
                  // İkili satır — asimetrik
                  const [r1, r2] = ratios[ratioIndex % ratios.length];
                  ratioIndex++;
                  const cat1 = categories[i];
                  const cat2 = categories[i + 1];
                  rows.push(
                    <div key={`row-${i}`} className="flex gap-3" style={{ height: '120px' }}>
                      {[{ cat: cat1, flex: r1 }, { cat: cat2, flex: r2 }].map(({ cat, flex }) => (
                        <button key={cat.id}
                          onClick={() => { setActiveCategory(cat.id); setShowMenu(true); }}
                          className="relative overflow-hidden rounded-2xl group"
                          style={{ flex }}>
                          {cat.image_url ? (
                            <img src={cat.image_url} alt={cat.name}
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-800" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <div className="font-bold text-white text-sm leading-tight">{cat.name}</div>
                            <div className="text-white/50 text-xs mt-0.5">
                              {products.filter(p => p.category_id === cat.id).length} ürün
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                  i += 2;
                } else {
                  // Son tek kalan kategori — tam genişlik
                  const cat = categories[i];
                  rows.push(
                    <button key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setShowMenu(true); }}
                      className="relative overflow-hidden rounded-2xl w-full group"
                      style={{ height: '120px' }}>
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-800" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="font-bold text-white text-lg">{cat.name}</div>
                        <div className="text-white/50 text-xs mt-0.5">
                          {products.filter(p => p.category_id === cat.id).length} ürün
                        </div>
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

      {/* TAM MENÜ GÖRÜNÜMÜ */}
      {showMenu && (
        <div className="bg-stone-900 min-h-screen">
          {/* Üst bar */}
          <div className="sticky top-0 z-20 bg-stone-900/95 backdrop-blur-sm border-b border-stone-800 px-4 py-3 flex items-center gap-3">
            <button onClick={() => setShowMenu(false)}
              className="text-stone-400 hover:text-white transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h2 className="text-amber-500 font-bold text-lg" style={{fontFamily:'Georgia,serif'}}>{cafeName}</h2>
          </div>

          {/* Kategori tabs */}
          <div className="sticky top-14 z-10 bg-stone-900/95 backdrop-blur-sm border-b border-stone-800">
            <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${activeCategory === cat.id ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Ürünler — A konsepti: büyük görsel üstte */}
          <div className="p-4 grid grid-cols-2 gap-3">
            {filteredProducts.map(p => {
              const price = p.is_campaign && p.campaign_price ? p.campaign_price : p.price;
              return (
                <div key={p.id} className="bg-stone-800 rounded-2xl overflow-hidden border border-stone-700">
                  {/* Görsel */}
                  <div className="relative h-36">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-stone-700 to-stone-800 flex items-center justify-center">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(200,132,58,0.3)" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                          <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                        </svg>
                      </div>
                    )}
                    {p.is_campaign && (
                      <div className="absolute top-2 left-2 bg-amber-500 text-stone-900 text-xs font-bold px-2 py-0.5 rounded-full">
                        KAMPANYA
                      </div>
                    )}
                  </div>
                  {/* Bilgi */}
                  <div className="p-3">
                    <div className="font-semibold text-white text-sm mb-0.5 line-clamp-1">{p.name}</div>
                    {p.description && (
                      <div className="text-stone-500 text-xs line-clamp-1 mb-2">{p.description}</div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-amber-400 font-bold">₺{price}</span>
                        {p.is_campaign && p.campaign_price && (
                          <span className="text-stone-500 text-xs line-through ml-1">₺{p.price}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-stone-800 px-6 py-10 mt-4">
        <div className="max-w-lg mx-auto grid grid-cols-3 gap-6 text-sm mb-8">
          <div>
            <h3 className="text-amber-500 font-semibold mb-3">Hakkımızda</h3>
            <p className="text-stone-500 text-xs leading-relaxed">{cafeAbout}</p>
          </div>
          <div>
            <h3 className="text-amber-500 font-semibold mb-3">İletişim</h3>
            <div className="text-stone-500 text-xs space-y-1">
              {cafeAddress && <p>📍 {cafeAddress}</p>}
              {cafePhone && <p>📞 {cafePhone}</p>}
              {cafeEmail && <p>✉️ {cafeEmail}</p>}
            </div>
          </div>
          <div>
            <h3 className="text-amber-500 font-semibold mb-3">Kariyer</h3>
            <p className="text-stone-500 text-xs leading-relaxed">Ekibimize katılmak ister misiniz?</p>
            {cafeCareerEmail && (
              <a href={`mailto:${cafeCareerEmail}`} className="text-amber-500 text-xs hover:text-amber-400 transition mt-2 inline-block">
                Başvur →
              </a>
            )}
          </div>
        </div>
        <div className="text-center text-stone-600 text-xs border-t border-stone-800 pt-6">
          © 2025 {cafeName} · Tüm hakları saklıdır
          <span className="mx-2">·</span>
          <a href="/login" className="hover:text-stone-400 transition">Yönetim Paneli</a>
        </div>
      </footer>
    </div>
  );
}
