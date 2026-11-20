import { ZodError } from "zod";

/** Errors the API turns into a clean JSON response instead of a 500. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(`${what} not found`, 404);
export const conflict = (message: string, details?: Record<string, unknown>) => new AppError(message, 409, details);

/** Field-level problems, keyed by input path ("title", "attributes.ram"). */
export const invalid = (fieldErrors: Record<string, string>, message = "Please fix the highlighted fields") =>
  new AppError(message, 422, { fieldErrors });

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

/** Parses with a zod schema, throwing a 422 with per-field messages on failure. */
export function parseOrThrow<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: ZodError } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw invalid(zodFieldErrors(result.error));
  return result.data;
}
