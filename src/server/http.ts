import { NextResponse } from "next/server";
import { getDb, type Db } from "./db";
import { AppError } from "./errors";

/**
 * Wraps a route handler: hands it the database, and turns known errors into
 * `{ error, ...details }` JSON with the right status instead of a 500.
 */
export function route<Ctx>(handler: (ctx: { db: Db; req: Request; params: Record<string, string> }) => Promise<unknown>) {
  return async (req: Request, context: { params: Promise<Record<string, string>> } & Ctx) => {
    try {
      const db = await getDb();
      const params = context?.params ? await context.params : {};
      const result = await handler({ db, req, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { status: req.method === "POST" ? 201 : 200 });
    } catch (error) {
      if (error instanceof AppError) return NextResponse.json({ error: error.message, ...error.details }, { status: error.status });
      console.error(error);
      return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("Request body must be JSON", 400);
  }
}

export function idParam(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("Invalid id", 400);
  return id;
}
