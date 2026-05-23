'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Category { id: number; name: string; }
interface Product {
  id: number; category_id: number; category_name: string;
  name: string; description: string; price: number;
  image_url: string; is_campaign: boolean; campaign_price: number;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [siteSettings, setSiteSettings] = useState<any>({});

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
        const s = settingsRes.data;
        setSiteSettings(s);
        if (cats.data.length > 0) setActiveCategory(cats.data[0].id);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  const filtered = activeCategory === -1
    ? products.filter(p => p.is_campaign)
    : products.filter(p => p.category_id === activeCategory);

  const campaigns = products.filter(p => p.is_campaign);
  const s = siteSettings;

  return (
    <div className="min-h-screen bg-stone-900 text-white">
      {/* Hero */}
      <div className="relative bg-gradient-to-b from-stone-800 to-stone-900 px-6 pt-16 pb-12 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{backgroundImage: 'radial-gradient(circle at 50% 50%, #c8843a 0%, transparent 60%)'}} />
        <div className="relative z-10">
          <h1 className="text-5xl font-bold text-amber-500 mb-3" style={{fontFamily:'Georgia,serif'}}>
            {s.cafe_name || 'Monet Cafe'}
          </h1>
          <p className="text-stone-400 text-lg mb-8">{s.cafe_slogan || ''}</p>
          <a href="#menu"
            className="inline-block bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold px-8 py-3 rounded-full transition text-lg">
            Menüyü Keşfet →
          </a>
        </div>
      </div>

      {/* Sosyal Medya */}
      <div className="flex justify-center gap-6 py-6 border-b border-stone-800">
        {[
          { label: 'Instagram', href: s.cafe_instagram || '#', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
            </svg>
          )},
          { label: 'Facebook', href: s.cafe_facebook || '#', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
          )},
          { label: 'WhatsApp', href: s.cafe_whatsapp ? `https://wa.me/${s.cafe_whatsapp}` : '#', icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          )},
        ].map(item => (
          <a key={item.label} href={item.href}
            className="flex items-center gap-2 text-stone-400 hover:text-amber-500 transition text-sm">
            {item.icon}{item.label}
          </a>
        ))}
      </div>

      {/* Menü */}
      <div id="menu" className="max-w-2xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-center text-amber-500 mb-8" style={{fontFamily:'Georgia,serif'}}>
          Menümüz
        </h2>

        {/* Kategori Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {campaigns.length > 0 && (
            <button onClick={() => setActiveCategory(-1)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${activeCategory === -1 ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>
              🔥 Kampanya
            </button>
          )}
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${activeCategory === c.id ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* Ürünler */}
        {loading ? (
          <div className="text-center py-10 text-stone-500">Yükleniyor...</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => {
              const price = p.is_campaign && p.campaign_price ? p.campaign_price : p.price;
              return (
                <div key={p.id} className="bg-stone-800 border border-stone-700 rounded-xl p-4 flex gap-4">
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
                        {p.description && <div className="text-stone-500 text-sm mt-1">{p.description}</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-amber-400 font-bold">₺{price}</div>
                        {p.is_campaign && p.campaign_price && (
                          <div className="text-stone-500 text-xs line-through">₺{p.price}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-800 px-6 py-10 mt-8">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-6 text-sm mb-8">
          <div>
            <h3 className="text-amber-500 font-semibold mb-3">Hakkımızda</h3>
            <p className="text-stone-500 text-xs leading-relaxed">
              {s.cafe_about || ''}
            </p>
          </div>
          <div>
            <h3 className="text-amber-500 font-semibold mb-3">İletişim</h3>
            <div className="text-stone-500 text-xs space-y-1">
              {s.cafe_address && <p>📍 {s.cafe_address}</p>}
              <p>📞 {s.cafe_phone || 'Instagram üzerinden ulaşın'}</p>
              {s.cafe_email && <p>✉️ {s.cafe_email}</p>}
            </div>
          </div>
          <div>
            <h3 className="text-amber-500 font-semibold mb-3">Kariyer</h3>
            <p className="text-stone-500 text-xs leading-relaxed">
              Ekibimize katılmak ister misiniz? CV&apos;nizi bize gönderin.
            </p>
            {s.cafe_career_email && (
              <a href={`mailto:${s.cafe_career_email}`}
                className="text-amber-500 text-xs hover:text-amber-400 transition mt-2 inline-block">
                Başvur →
              </a>
            )}
          </div>
        </div>
        <div className="text-center text-stone-600 text-xs border-t border-stone-800 pt-6">
          © 2025 {s.cafe_name || 'Monet Cafe'} · Tüm hakları saklıdır
          <span className="mx-2">·</span>
          <a href="/login" className="hover:text-stone-400 transition">Yönetim Paneli</a>
        </div>
      </footer>
    </div>
  );
}
