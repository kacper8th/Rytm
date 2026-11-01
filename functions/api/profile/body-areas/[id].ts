import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { conflict, isId, parseNameBody } from "../../../_lib/profile";

/** PATCH /api/profile/body-areas/:id — body { name }: renames a body area. Returns { id, name }. */
export const onRequestPatch: PagesFunction<Env, "id"> = async ({ env, params, request }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const name = parseNameBody(body);
  if (typeof name !== "string") return badRequest(name.error);

  const result = await env.DB.prepare("UPDATE body_areas SET name = ? WHERE id = ?").bind(name, params.id).run();
  if (!result.meta.changes) return notFound("Body area not found.");

  return json({ id: params.id, name });
};

/** DELETE /api/profile/body-areas/:id — removes a body area; refused (409) while it has health conditions. */
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  const result = await env.DB.prepare(
    "DELETE FROM body_areas WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM health_conditions WHERE area_id = ?1)",
  )
    .bind(params.id)
    .run();
  if (result.meta.changes) return new Response(null, { status: 204 });

  const area = await env.DB.prepare("SELECT 1 FROM body_areas WHERE id = ?").bind(params.id).first();
  return area ? conflict("Body area has health conditions.") : notFound("Body area not found.");
};
