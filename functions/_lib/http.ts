/**
 * API helpers shared by every endpoint — the D1 binding and JSON responses.
 */

export interface Env {
  DB: D1Database;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function badRequest(error: string): Response {
  return json({ error }, 400);
}

export function notFound(error: string): Response {
  return json({ error }, 404);
}
