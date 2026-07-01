'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data, error } = await authClient.getSession();
      
      const isAuthRoute = pathname?.startsWith('/login') || pathname?.startsWith('/register');
      const isAdminRoute = pathname?.startsWith('/admin');
      
      if (!isAdminRoute) {
        if (!data && !isAuthRoute) {
          router.push('/login');
        } else if (data && isAuthRoute) {
          router.push('/');
        }
      }
      
      setIsAuthenticated(!!data);
      setLoading(false);
    };
    
    checkAuth();
  }, [pathname, router]);

  // Don't render protected content while checking auth (except for admin/auth routes)
  if (loading && !pathname?.startsWith('/admin') && !pathname?.startsWith('/login')) {
    return <div className="min-h-screen flex items-center justify-center bg-surface-950 text-white">Carregando...</div>;
  }

  return <>{children}</>;
}
