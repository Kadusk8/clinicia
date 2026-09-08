const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Guards against the model passing a made-up value (a name, a slug like
 * "cirurgia-ortognatica", a placeholder like "professional_id") instead of a
 * real UUID it already received from an earlier tool call. Without this,
 * Drizzle/Postgres throws a raw "invalid input syntax for type uuid" error
 * on the query itself — before any "not found" check even runs — which is a
 * much worse signal for the model to self-correct on than a clear message
 * telling it exactly which id is wrong and where a real one comes from.
 *
 * Returns a ready-to-return JSON error string when `value` isn't a real
 * UUID, or `null` when it's fine to proceed with the query.
 */
export function invalidIdError(field: string, value: unknown): string | null {
  if (isUuid(value)) return null;
  return JSON.stringify({
    error:
      `${field} inválido: "${value}" não é um ID válido. Use exatamente o UUID ` +
      'retornado por uma tool anterior nesta conversa (buscar_paciente/cadastrar_paciente, ' +
      'listar_servicos ou verificar_disponibilidade) — nunca invente, abrevie ou use um nome/slug.',
  });
}
