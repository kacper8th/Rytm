import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { parseConditionBody } from "../../../_lib/profile";

/** POST /api/profile/health-conditions — body { areaId, description, source, date }: adds a condition to an area. */
export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const condition = parseConditionBody(body);
  if (typeof condition === "string") return badRequest(condition);

  const id = crypto.randomUUID();
  const result = await env.DB.prepare(
    `INSERT INTO health_conditions (id, area_id, description, source, date, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE EXISTS (SELECT 1 FROM body_areas WHERE id = ?2)`,
  )
    .bind(id, condition.areaId, condition.description, condition.source, condition.date, new Date().toISOString())
    .run();
  if (!result.meta.changes) return notFound("Body area not found.");

  return json({ id, ...condition }, 201);
};
