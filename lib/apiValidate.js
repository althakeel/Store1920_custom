import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Parse request JSON with a Zod schema.
 * @returns {{ data: any, error: null } | { data: null, error: NextResponse }}
 */
export async function parseJsonBody(request, schema) {
  let raw;
  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 },
      ),
    };
  }

  return parseWithSchema(raw, schema);
}

/**
 * @returns {{ data: any, error: null } | { data: null, error: NextResponse }}
 */
export function parseWithSchema(raw, schema) {
  try {
    const data = schema.parse(raw);
    return { data, error: null };
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      }));
      return {
        data: null,
        error: NextResponse.json(
          {
            error: issues[0]?.message || 'Validation failed',
            code: 'VALIDATION_ERROR',
            issues,
          },
          { status: 400 },
        ),
      };
    }
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR' },
        { status: 400 },
      ),
    };
  }
}

/** Light string cleanup for free-text fields before persistence. */
export function sanitizePlainText(value, { maxLength = 2000 } = {}) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLength);
}
