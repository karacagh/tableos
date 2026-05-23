'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setAuth, User } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token, user } = res.data;
      setAuth(token, user as User);

      const routes: Record<string, string> = {
        admin: '/dashboard',
        manager: '/dashboard',
        waiter: '/waiter',
        cashier: '/cashier',
        kitchen: '/kitchen',
      };
      const targetRoute = routes[user.role] || '/dashboard';
      window.location.href = targetRoute;
    } catch (err: any) {
      console.error('Login error:', err);
      console.error('Response:', err.response?.data);
      console.error('Status:', err.response?.status);
      toast.error(err.response?.data?.error || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-500">Monet Cafe</h1>
          <p className="text-stone-400 text-sm mt-2">Yönetim Paneli</p>
        </div>
        <form onSubmit={handleLogin} className="bg-stone-800 rounded-2xl p-8 space-y-4">
          <div>
            <label className="block text-stone-300 text-sm mb-2">E-posta</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-stone-700 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="admin@monetcafe.net"
              required
            />
          </div>
          <div>
            <label className="block text-stone-300 text-sm mb-2">Şifre</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-stone-700 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-900 font-semibold rounded-lg py-3 text-sm transition"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
