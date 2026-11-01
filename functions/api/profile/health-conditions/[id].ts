import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { isId, parseConditionBody } from "../../../_lib/profile";

/**
 * PATCH /api/profile/health-conditions/:id — body { areaId, description, source, date }: replaces a condition;
 * a different areaId moves it to that area. Returns the condition.
 */
export const onRequestPatch: PagesFunction<Env, "id"> = async ({ env, params, request }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const condition = parseConditionBody(body);
  if (typeof condition === "string") return badRequest(condition);

  const result = await env.DB.prepare(
    `UPDATE health_conditions SET area_id = ?2, description = ?3, source = ?4, date = ?5
     WHERE id = ?1 AND EXISTS (SELECT 1 FROM body_areas WHERE id = ?2)`,
  )
    .bind(params.id, condition.areaId, condition.description, condition.source, condition.date)
    .run();
  if (!result.meta.changes) return notFound("Health condition or body area not found.");

  return json({ id: params.id, ...condition });
};

/** DELETE /api/profile/health-conditions/:id — removes a condition. */
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  const result = await env.DB.prepare("DELETE FROM health_conditions WHERE id = ?").bind(params.id).run();
  if (!result.meta.changes) return notFound("Health condition not found.");

  return new Response(null, { status: 204 });
};
