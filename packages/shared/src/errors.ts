// ==========================================
// Result Type
// ==========================================

export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// ==========================================
// Error Classes
// ==========================================

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} com ID ${id} não encontrado` : `${resource} não encontrado`;
    super(msg, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class TenantMismatchError extends AppError {
  constructor() {
    super(
      'Tentativa de acessar recurso de outro tenant',
      'TENANT_MISMATCH',
      403,
    );
    this.name = 'TenantMismatchError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(serviceName: string, details?: unknown) {
    super(
      `Erro ao comunicar com serviço externo: ${serviceName}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      details,
    );
    this.name = 'ExternalServiceError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Limite de requisições excedido') {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
  }
}
