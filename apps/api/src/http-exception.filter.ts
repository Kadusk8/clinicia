import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AppError } from '@crm-clinicas/shared';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FK_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno do servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
    } else if (exception instanceof AppError) {
      status = exception.statusCode;
      message = exception.message;
    } else if (isDbError(exception)) {
      const code = (exception as any).code;
      if (code === PG_UNIQUE_VIOLATION) {
        status = HttpStatus.CONFLICT;
        const detail: string = (exception as any).detail || '';
        if (detail.includes('slug')) {
          message = 'Já existe uma clínica com esse slug. Tente um nome diferente.';
        } else if (detail.includes('email')) {
          message = 'Esse e-mail já está cadastrado.';
        } else {
          message = 'Registro duplicado. Verifique os dados e tente novamente.';
        }
      } else if (code === PG_FK_VIOLATION) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Referência inválida nos dados enviados.';
      } else if (code === PG_NOT_NULL_VIOLATION) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Campo obrigatório não informado.';
      } else {
        this.logger.error(`DB error ${code}: ${(exception as any).message}`);
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    reply.status(status).send({ statusCode: status, message });
  }
}

function isDbError(e: unknown): boolean {
  return (
    e instanceof Error &&
    typeof (e as any).code === 'string' &&
    (e as any).code.length === 5
  );
}
