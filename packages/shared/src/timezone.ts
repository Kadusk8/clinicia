// Helpers de fuso horário de Brasília, usados em qualquer lugar que precise
// calcular datas/horários reais da clínica (disponibilidade de agenda,
// agendamento de follow-up, etc.).
//
// workingHours e a janela de envio de follow-up são sempre horário de
// Brasília ("08:00" etc.), mas o processo roda em UTC em produção —
// Date#getHours/getDay/setHours usam o timezone do processo, não o da
// clínica, então essa aritmética não pode usar os métodos nativos de Date.
// Brasil não tem mais horário de verão desde 2019, então -03:00 é um offset
// fixo seguro pra São Paulo.
import type { DayOfWeek } from './types.js';

export const CLINIC_UTC_OFFSET = '-03:00';

export const WEEKDAY_BY_SHORT_NAME: Record<string, DayOfWeek> = {
  Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat',
};

export function brasiliaDateParts(
  instant: Date,
): { year: number; month: number; day: number; weekday: DayOfWeek } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: WEEKDAY_BY_SHORT_NAME[get('weekday')]!,
  };
}

export function brasiliaTimeParts(instant: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { hour: Number(get('hour')), minute: Number(get('minute')) };
}

// Instante UTC correspondente a HH:MM naquele dia, em horário de Brasília.
export function brasiliaInstant(year: number, month: number, day: number, hour: number, minute: number): Date {
  const pad = (n: number) => String(n).padStart(2, '0');
  return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${CLINIC_UTC_OFFSET}`);
}

// O ISO devolvido pelas tools é UTC; sem um rótulo pronto em horário de
// Brasília o modelo lê a hora do ISO e oferece ao paciente um horário 3h
// adiantado (ex: anunciar "18h" para um slot que na verdade é 15h).
export function brasiliaLabel(instant: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(instant);
}

// ==========================================
// Janela de envio de follow-up (08h-20h de Brasília)
// ==========================================

export const SEND_WINDOW = { startHour: 8, endHour: 20 };

export function isWithinSendWindow(instant: Date): boolean {
  const { hour } = brasiliaTimeParts(instant);
  return hour >= SEND_WINDOW.startHour && hour < SEND_WINDOW.endHour;
}

// Empurra o instante pra dentro da janela comercial, sempre pra frente no
// tempo — nunca antecipa um envio, só atrasa: antes das 8h vira 8h do mesmo
// dia; 20h ou depois vira 8h do dia seguinte.
export function clampToSendWindow(instant: Date): Date {
  const { year, month, day } = brasiliaDateParts(instant);
  const { hour } = brasiliaTimeParts(instant);

  if (hour < SEND_WINDOW.startHour) {
    return brasiliaInstant(year, month, day, SEND_WINDOW.startHour, 0);
  }
  if (hour >= SEND_WINDOW.endHour) {
    const nextDay = new Date(brasiliaInstant(year, month, day, 12, 0).getTime() + 24 * 60 * 60 * 1000);
    const next = brasiliaDateParts(nextDay);
    return brasiliaInstant(next.year, next.month, next.day, SEND_WINDOW.startHour, 0);
  }
  return instant;
}
