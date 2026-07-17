import { z } from 'zod';
import {
  CLINIC_TYPES,
  USER_ROLES,
  APPOINTMENT_STATUSES,
  DEAL_STAGES,
  FOLLOW_UP_TYPES,
  URGENCY_LEVELS,
  PLAN_TYPES,
} from './types.js';

// ==========================================
// Clinic Validators
// ==========================================

export const createClinicSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  type: z.enum(CLINIC_TYPES),
  timezone: z.string().default('America/Sao_Paulo'),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
});

export const updateClinicSchema = createClinicSchema.partial();

// ==========================================
// Admin Validators (super admin panel)
// ==========================================

export const adminCreateClinicSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  type: z.enum(CLINIC_TYPES),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  plan: z.enum(PLAN_TYPES).optional(),
  agentConfig: z.record(z.string(), z.unknown()).optional(),
  agentSystemPrompt: z.string().optional(),
  agentKnowledgeBase: z.string().optional(),
  ownerName: z.string().min(2).max(255),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
});

export const adminUpdateClinicSchema = adminCreateClinicSchema
  .omit({ ownerName: true, ownerEmail: true, ownerPassword: true })
  .partial();

export const adminUpdateAgentSchema = z.object({
  agentConfig: z.record(z.string(), z.unknown()).optional(),
  agentSystemPrompt: z.string().optional(),
  agentKnowledgeBase: z.string().optional(),
});

export const createKnowledgeBaseDocSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1),
});

export const adminUpdateWhatsAppSchema = z.object({
  whatsappInstanceName: z.string().min(1).max(100).optional(),
  evolutionApiUrl: z.string().url().optional(),
  evolutionApiKey: z.string().min(1).optional(),
  whatsappConnected: z.boolean().optional(),
});

// ==========================================
// User Validators
// ==========================================

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(255),
  role: z.enum(USER_ROLES),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ==========================================
// Patient Validators
// ==========================================

export const createPatientSchema = z.object({
  phone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^\+?\d+$/, 'Telefone deve conter apenas números'),
  name: z.string().min(2).max(255).optional(),
  birthDate: z.string().optional(), // YYYY-MM-DD
  email: z.string().email().optional(),
  cpf: z.string().max(14).optional(),
  insurance: z.string().max(100).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lgpdConsent: z.boolean().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

// ==========================================
// Service Validators
// ==========================================

export const createServiceSchema = z.object({
  name: z.string().min(2).max(255),
  category: z.string().max(100).optional(),
  description: z.string().optional(),
  durationMin: z.number().int().positive().max(480),
  priceCents: z.number().int().nonnegative().optional(),
  acceptsInsurance: z.boolean().default(false),
  insurancePlans: z.array(z.string()).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

// ==========================================
// Professional Validators
// ==========================================

const timeSlotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Formato: HH:MM'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Formato: HH:MM'),
});

const workingHoursSchema = z
  .object({
    mon: z.array(timeSlotSchema).optional(),
    tue: z.array(timeSlotSchema).optional(),
    wed: z.array(timeSlotSchema).optional(),
    thu: z.array(timeSlotSchema).optional(),
    fri: z.array(timeSlotSchema).optional(),
    sat: z.array(timeSlotSchema).optional(),
    sun: z.array(timeSlotSchema).optional(),
  })
  .optional();

export const createProfessionalSchema = z.object({
  name: z.string().min(2).max(255),
  speciality: z.string().max(100).optional(),
  registration: z.string().max(50).optional(),
  workingHours: workingHoursSchema,
  userId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

export const updateProfessionalSchema = createProfessionalSchema.partial();

// ==========================================
// Appointment Validators
// ==========================================

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime(),
  notes: z.string().optional(),
  source: z.string().default('manual'),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  notes: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  cancellationReason: z.string().optional(),
});

// ==========================================
// Deal Validators
// ==========================================

export const createDealSchema = z.object({
  patientId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  stage: z.enum(DEAL_STAGES).default('lead'),
  valueCents: z.number().int().nonnegative().optional(),
  ownerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const updateDealSchema = z.object({
  stage: z.enum(DEAL_STAGES).optional(),
  valueCents: z.number().int().nonnegative().optional(),
  ownerId: z.string().uuid().optional(),
  lostReason: z.string().optional(),
  notes: z.string().optional(),
});

// ==========================================
// Conversation Validators
// ==========================================

export const sendMessageSchema = z.object({
  content: z.string().min(1),
  mediaUrl: z.string().url().optional(),
  mediaType: z.string().optional(),
});

// ==========================================
// Follow-up Validators
// ==========================================

export const createFollowUpSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  type: z.enum(FOLLOW_UP_TYPES),
  scheduledFor: z.string().datetime(),
  templateKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ==========================================
// Agent Tool Input Validators
// ==========================================

export const buscarPacienteSchema = z.object({
  phone: z.string(),
});

export const cadastrarPacienteSchema = z.object({
  phone: z.string(),
  name: z.string(),
  birthDate: z.string().optional(),
  email: z.string().email().optional(),
  insurance: z.string().optional(),
});

export const listarServicosSchema = z.object({
  categoria: z.string().optional(),
});

export const verificarDisponibilidadeSchema = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid().optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const agendarConsultaSchema = z.object({
  patientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startsAt: z.string().datetime(),
});

export const cancelarOuRemarcarSchema = z.object({
  appointmentId: z.string().uuid(),
  action: z.enum(['cancel', 'reschedule']),
  newStartsAt: z.string().datetime().optional(),
  reason: z.string().optional(),
});

export const registrarAnotacaoCrmSchema = z.object({
  patientId: z.string().uuid(),
  note: z.string(),
  tags: z.array(z.string()).optional(),
});

export const transferirHumanoSchema = z.object({
  motivo: z.string(),
  urgencia: z.enum(URGENCY_LEVELS),
});

export const consultarBaseConhecimentoSchema = z.object({
  query: z.string(),
});

// ==========================================
// Pagination
// ==========================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
