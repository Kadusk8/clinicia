'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface AppointmentsReport {
  total: number;
  totalRevenueCents: number;
  byStatus: Record<string, { count: number; revenueCents: number }>;
}

interface ConversationsReport {
  total: number;
  convertedCount: number;
  byStatus: Record<string, number>;
}

const STATUS_LABEL_APT: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

const STATUS_LABEL_CONV: Record<string, string> = {
  agent_active: 'Com IA',
  human_active: 'Com Humano',
  closed: 'Encerrado',
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState(getDefaultRange);
  const [aptReport, setAptReport]   = useState<AppointmentsReport | null>(null);
  const [convReport, setConvReport] = useState<ConversationsReport | null>(null);
  const [loading, setLoading]       = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const fromISO = new Date(dateRange.from).toISOString();
      const toISO = new Date(dateRange.to + 'T23:59:59').toISOString();
      const [apt, conv] = await Promise.all([
        api.getAppointmentsReport(fromISO, toISO) as Promise<AppointmentsReport>,
        api.getConversationsReport() as Promise<ConversationsReport>,
      ]);
      setAptReport(apt);
      setConvReport(conv);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  function handleExport() {
    const fromISO = new Date(dateRange.from).toISOString();
    const toISO = new Date(dateRange.to + 'T23:59:59').toISOString();
    window.open(api.exportAppointmentsCsvUrl(fromISO, toISO), '_blank');
  }

  const conversionRate = convReport && convReport.total > 0
    ? Math.round((convReport.convertedCount / convReport.total) * 100)
    : 0;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Relatórios</h1>
          <p className="text-surface-500 mt-1">Análise de consultas e conversas</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="card p-4 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-surface-600">De</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
            className="input text-sm py-1.5"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-surface-600">Até</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
            className="input text-sm py-1.5"
          />
        </div>
        <button onClick={handleExport} className="btn-ghost text-sm flex items-center gap-2 ml-auto">
          <span>⬇</span>
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments Report */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-1">Consultas</h2>
          <p className="text-sm text-surface-400 mb-4">
            {dateRange.from} — {dateRange.to}
          </p>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-surface-100 rounded animate-pulse" />)}
            </div>
          ) : aptReport ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-primary-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-primary-700">{aptReport.total}</p>
                  <p className="text-xs text-primary-500">Total de consultas</p>
                </div>
                <div className="bg-accent-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-accent-700">{formatMoney(aptReport.totalRevenueCents)}</p>
                  <p className="text-xs text-accent-500">Receita prevista</p>
                </div>
              </div>

              {/* By status */}
              <div className="space-y-2">
                {Object.entries(aptReport.byStatus).map(([status, data]) => (
                  <div key={status} className="flex items-center justify-between p-2 rounded-lg bg-surface-50">
                    <span className="text-sm text-surface-700">{STATUS_LABEL_APT[status] ?? status}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-surface-400">{formatMoney(data.revenueCents)}</span>
                      <span className="text-sm font-semibold text-surface-800 min-w-[24px] text-right">{data.count}</span>
                    </div>
                  </div>
                ))}
                {Object.keys(aptReport.byStatus).length === 0 && (
                  <p className="text-sm text-surface-400 text-center py-4">Nenhuma consulta no período</p>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Conversations Report */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-1">Conversas</h2>
          <p className="text-sm text-surface-400 mb-4">Total acumulado</p>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-surface-100 rounded animate-pulse" />)}
            </div>
          ) : convReport ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-primary-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-primary-700">{convReport.total}</p>
                  <p className="text-xs text-primary-500">Total de conversas</p>
                </div>
                <div className="bg-accent-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-accent-700">{conversionRate}%</p>
                  <p className="text-xs text-accent-500">Taxa de conversão</p>
                </div>
              </div>

              {/* By status */}
              <div className="space-y-2">
                {Object.entries(convReport.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between p-2 rounded-lg bg-surface-50">
                    <span className="text-sm text-surface-700">{STATUS_LABEL_CONV[status] ?? status}</span>
                    <span className="text-sm font-semibold text-surface-800">{count}</span>
                  </div>
                ))}
                {Object.keys(convReport.byStatus).length === 0 && (
                  <p className="text-sm text-surface-400 text-center py-4">Nenhuma conversa ainda</p>
                )}
              </div>

              <div className="mt-4 p-3 bg-surface-50 rounded-xl">
                <p className="text-xs text-surface-500">
                  <span className="font-medium text-surface-700">{convReport.convertedCount}</span> conversas
                  resultaram em agendamento
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
