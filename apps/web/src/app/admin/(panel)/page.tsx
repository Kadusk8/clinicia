'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalClinics: number;
  activeClinics: number;
  suspendedClinics: number;
  totalPatients: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalClinics: 0, activeClinics: 0, suspendedClinics: 0, totalPatients: 0,
  });

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-surface-400 mt-1">Visão geral da plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Clínicas', value: stats.totalClinics, icon: '🏥', color: 'from-primary-500 to-primary-600' },
          { label: 'Clínicas Ativas', value: stats.activeClinics, icon: '✅', color: 'from-accent-500 to-accent-600' },
          { label: 'Suspensas', value: stats.suspendedClinics, icon: '⛔', color: 'from-red-500 to-red-600' },
          { label: 'Total Pacientes', value: stats.totalPatients, icon: '👥', color: 'from-amber-500 to-amber-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-900 border border-surface-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
              <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center text-white font-bold text-sm`}>
                {stat.value}
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-surface-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Ações Rápidas</h2>
        <div className="flex gap-4">
          <Link
            href="/admin/clinics/new"
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded-xl hover:from-red-700 hover:to-orange-600 transition-all"
          >
            + Nova Clínica
          </Link>
          <Link
            href="/admin/clinics"
            className="px-6 py-3 bg-surface-800 text-surface-300 font-medium rounded-xl hover:bg-surface-700 transition-all border border-surface-700"
          >
            Ver todas clínicas
          </Link>
        </div>
      </div>
    </div>
  );
}
