'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface UpcomingAppointment {
  id: string;
  startsAt: string;
  status: string;
  patientName: string | null;
  patientPhone: string | null;
  serviceName: string | null;
  professionalName: string | null;
}

interface RecentConversation {
  id: string;
  externalId: string | null;
  status: string;
  unreadCount: number | null;
  lastMessageAt: string | null;
  patientName: string | null;
}

interface Overview {
  totalPatients: number;
  appointmentsToday: number;
  activeConversations: number;
  unreadMessages: number;
  upcomingAppointments: UpcomingAppointment[];
  recentConversations: RecentConversation[];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `Hoje ${formatTime(iso)}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Amanhã ${formatTime(iso)}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + formatTime(iso);
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    human_active: 'bg-amber-100 text-amber-700',
    agent_active: 'bg-accent-100 text-accent-700',
    closed: 'bg-surface-100 text-surface-400',
  };
  return map[s] ?? 'bg-surface-100 text-surface-400';
}

function statusLabel(s: string) {
  return s === 'human_active' ? 'Humano' : s === 'agent_active' ? 'IA' : 'Fechada';
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOverview()
      .then((data) => setOverview(data as Overview))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: 'Pacientes',
      value: loading ? '—' : String(overview?.totalPatients ?? 0),
      change: 'total cadastrados',
      icon: '👥',
      color: 'primary',
    },
    {
      label: 'Consultas Hoje',
      value: loading ? '—' : String(overview?.appointmentsToday ?? 0),
      change: 'agendadas',
      icon: '📅',
      color: 'accent',
    },
    {
      label: 'Conversas Ativas',
      value: loading ? '—' : String(overview?.activeConversations ?? 0),
      change: `${overview?.unreadMessages ?? 0} não lidas`,
      icon: '💬',
      color: 'amber',
    },
    {
      label: 'Não Lidas',
      value: loading ? '—' : String(overview?.unreadMessages ?? 0),
      change: 'mensagens pendentes',
      icon: '📨',
      color: 'purple',
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-surface-900">Dashboard</h1>
        <p className="text-surface-500 mt-1">Visão geral da sua clínica</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-xs text-surface-400">{stat.change}</span>
            </div>
            <div className="mt-2">
              <p className={`text-3xl font-bold ${loading ? 'text-surface-300' : 'text-surface-900'}`}>
                {stat.value}
              </p>
              <p className="text-sm text-surface-500 mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">Próximas Consultas</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-surface-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !overview?.upcomingAppointments?.length ? (
            <div className="text-center py-12 text-surface-400">
              <span className="text-4xl mb-3 block">📅</span>
              <p>Nenhuma consulta agendada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overview.upcomingAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
                  <div className="text-center min-w-[48px]">
                    <p className="text-xs text-surface-400">
                      {new Date(apt.startsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                    <p className="text-sm font-bold text-surface-800">{formatTime(apt.startsAt)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">
                      {apt.patientName ?? apt.patientPhone ?? 'Paciente'}
                    </p>
                    <p className="text-xs text-surface-400 truncate">
                      {apt.serviceName ?? 'Consulta'}{apt.professionalName ? ` · ${apt.professionalName}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Conversations */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">Conversas Recentes</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-surface-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !overview?.recentConversations?.length ? (
            <div className="text-center py-12 text-surface-400">
              <span className="text-4xl mb-3 block">💬</span>
              <p>Nenhuma conversa ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overview.recentConversations.map((conv) => (
                <div key={conv.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-surface-800 truncate">
                        {conv.patientName ?? conv.externalId ?? 'Paciente'}
                      </p>
                      {(conv.unreadCount ?? 0) > 0 && (
                        <span className="badge-danger text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-400">
                      {conv.lastMessageAt ? formatDate(conv.lastMessageAt) : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${statusBadge(conv.status)}`}>
                    {statusLabel(conv.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
