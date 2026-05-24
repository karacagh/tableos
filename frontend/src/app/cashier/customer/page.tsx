'use client';
import { useEffect, useState } from 'react';
import socket from '@/lib/socket';
import api from '@/lib/api';

interface OrderItem { name: string; quantity: number; unit_price: number; }
interface BillDisplay {
  table_zone: string;
  table_number: number;
  items: OrderItem[];
  total: number;
  payment_method?: string;
  status: 'idle' | 'open' | 'paid';
}

export default function CustomerScreen() {
  const [bill, setBill] = useState<BillDisplay | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [paid, setPaid] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    // Saat güncelle
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'}));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    // Ayarları yükle
    api.get('/api/settings').then(res => setSettings(res.data)).catch(() => {});

    // Socket bağlantısı
    socket.connect();

    // Kasiyer adisyon seçince göster
    socket.on('customer_screen_update', (data: BillDisplay) => {
      setPaid(false);
      setBill(data);
    });

    // Adisyon kapanınca ödendi ekranı
    socket.on('customer_screen_paid', () => {
      setPaid(true);
      setTimeout(() => {
        setPaid(false);
        setBill(null);
      }, 4000);
    });

    // Temizle
    socket.on('customer_screen_clear', () => {
      setBill(null);
      setPaid(false);
    });

    return () => {
      clearInterval(timer);
      socket.off('customer_screen_update');
      socket.off('customer_screen_paid');
      socket.off('customer_screen_clear');
      socket.disconnect();
    };
  }, []);

  const cafeName = settings.cafe_name || 'Monet Cafe';
  const cafeSlogan = settings.cafe_slogan || 'Çikolata Daima İyi Bir Fikirdir.';

  // Ödendi ekranı
  if (paid) return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl mb-6 animate-bounce">✅</div>
        <h2 className="text-4xl font-bold text-white mb-3">Ödeme Alındı</h2>
        <p className="text-green-300 text-xl">Teşekkürler, iyi günler!</p>
      </div>
    </div>
  );

  // Boş ekran — cafe bilgisi
  if (!bill) return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Arka plan efekti */}
      <div className="absolute inset-0 opacity-5"
        style={{backgroundImage: 'radial-gradient(circle at 50% 50%, #c8843a 0%, transparent 60%)'}} />

      <div className="relative z-10 text-center px-8">
        <h1 className="text-7xl font-bold text-amber-500 mb-4"
          style={{fontFamily: 'Georgia, serif'}}>
          {cafeName}
        </h1>
        <p className="text-2xl text-stone-400 mb-12 italic">{cafeSlogan}</p>

        {/* Saat */}
        <div className="text-6xl font-bold text-stone-300 mb-12 font-mono">
          {currentTime}
        </div>

        <div className="text-stone-600 text-lg">Hoş geldiniz</div>
      </div>
    </div>
  );

  // Adisyon ekranı
  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-stone-800 border-b border-stone-700 px-8 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-500" style={{fontFamily:'Georgia,serif'}}>{cafeName}</h1>
        <div className="text-stone-400 text-lg">{bill.table_zone} · Masa {bill.table_number}</div>
      </div>

      {/* Adisyon */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-8 py-6">
        <h2 className="text-stone-400 text-sm font-semibold uppercase tracking-wider mb-4">Siparişleriniz</h2>

        <div className="flex-1 space-y-3 mb-6">
          {bill.items?.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-stone-700">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-stone-700 rounded-lg flex items-center justify-center text-amber-400 font-bold">
                  {item.quantity}
                </div>
                <div className="text-lg text-white">{item.name}</div>
              </div>
              <div className="text-amber-400 text-lg font-semibold">
                ₺{(item.quantity * item.unit_price).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Toplam */}
        <div className="bg-stone-800 rounded-2xl p-6 border border-stone-700">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-semibold text-stone-300">Toplam</span>
            <span className="text-4xl font-bold text-amber-400">₺{bill.total?.toFixed(2)}</span>
          </div>
          {bill.payment_method && (
            <div className="mt-3 text-center text-stone-400 text-sm">
              {bill.payment_method === 'cash' ? '💵 Nakit' : bill.payment_method === 'card' ? '💳 Kart' : '🍽️ Yemek Kartı'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
