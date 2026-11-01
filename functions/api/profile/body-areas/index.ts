import { badRequest, json, type Env } from "../../../_lib/http";
import { parseNameBody } from "../../../_lib/profile";

/** POST /api/profile/body-areas — body { name }: adds a body area (shown last). Returns { id, name }. */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const name = parseNameBody(body);
  if (typeof name !== "string") return badRequest(name.error);

  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO body_areas (id, name, created_at) VALUES (?, ?, ?)")
    .bind(id, name, new Date().toISOString())
    .run();

  return json({ id, name }, 201);
};
