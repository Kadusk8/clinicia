// ==========================================
// Enums & Constants
// ==========================================

export const CLINIC_TYPES = ['medical', 'dental', 'other'] as const;
export type ClinicType = (typeof CLINIC_TYPES)[number];

export const USER_ROLES = ['owner', 'admin', 'recepcao', 'profissional'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'completed',
  'no_show',
  'cancelled',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const CONVERSATION_STATUSES = ['agent_active', 'human_active', 'closed'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const MESSAGE_ROLES = ['patient', 'agent', 'staff', 'system'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const DEAL_STAGES = [
  'lead',
  'qualified',
  'scheduled',
  'attended',
  'treatment',
  'won',
  'lost',
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const FOLLOW_UP_TYPES = [
  'reminder_24h',
  'reminder_2h',
  'post_visit',
  'reactivation',
  'no_show',
] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const FOLLOW_UP_STATUSES = ['pending', 'sent', 'failed', 'cancelled'] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const PLAN_TYPES = ['trial', 'starter', 'pro', 'enterprise'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const APPOINTMENT_SOURCES = [
  'whatsapp_agent',
  'manual',
  'website',
  'phone',
] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

export const URGENCY_LEVELS = ['baixa', 'media', 'alta'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

// ==========================================
// Working Hours
// ==========================================

export interface TimeSlot {
  start: string; // "08:00"
  end: string; // "12:00"
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type WorkingHours = Partial<Record<DayOfWeek, TimeSlot[]>>;

// ==========================================
// Agent Config
// ==========================================

export interface AgentConfig {
  assistantName: string;
  greeting?: string;
  businessHours?: string;
  paymentMethods?: string[];
  insurances?: string[];
  customInstructions?: string;
}

// ==========================================
// API Response Types
// ==========================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
