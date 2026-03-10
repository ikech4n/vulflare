import { type MiddlewareHandler } from 'hono';
import { type ZodSchema, ZodError } from 'zod';

/**
 * Zodスキーマを使ってリクエストボディをバリデーションするミドルウェア
 */
export function validate<T>(schema: ZodSchema<T>): MiddlewareHandler {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      c.set('validatedBody', validated);
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        console.error('Validation failed:', JSON.stringify(errors, null, 2));
        return c.json({ error: 'Validation failed', details: errors }, 400);
      }
      console.error('Invalid request body:', error);
      return c.json({ error: 'Invalid request body' }, 400);
    }
  };
}
