'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    const routes: Record<string, string> = {
      admin: '/dashboard',
      manager: '/dashboard',
      waiter: '/waiter',
      cashier: '/cashier',
      kitchen: '/kitchen',
    };
    router.replace(routes[user.role] || '/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-stone-400 text-sm">Yönlendiriliyor...</div>
    </div>
  );
}
