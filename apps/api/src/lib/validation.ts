import type { FastifyReply } from 'fastify';
import type { ZodSchema } from 'zod';

export function parseWithSchema<T>(
  schema: ZodSchema<T>,
  data: unknown,
  reply: FastifyReply
): T | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    reply.status(400).send({
      error: 'Bad Request',
      issues: parsed.error.flatten(),
    });
    return null;
  }

  return parsed.data;
}
