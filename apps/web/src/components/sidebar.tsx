'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/inbox', label: 'Inbox', icon: '💬' },
  { href: '/patients', label: 'Pacientes', icon: '👥' },
  { href: '/agenda', label: 'Agenda', icon: '📅' },
  { href: '/pipeline', label: 'Pipeline', icon: '📈' },
  { href: '/services', label: 'Serviços', icon: '🩺' },
  { href: '/professionals', label: 'Profissionais', icon: '👨‍⚕️' },
  { href: '/reports', label: 'Relatórios', icon: '📊' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-surface-200 flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-surface-100">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
          </div>
          <div>
            <span className="text-xl font-bold text-surface-900">
              Clinic<span className="text-primary-600">IA</span>
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? 'sidebar-item-active' : 'sidebar-item'}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {item.label === 'Inbox' && (
                <span className="ml-auto badge-danger text-[10px]">0</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User / Footer */}
      <div className="p-4 border-t border-surface-100">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-surface-900 truncate">Usuário</p>
            <p className="text-xs text-surface-400 truncate">Minha Clínica</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
