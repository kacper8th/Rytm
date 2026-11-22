import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { isUuid, parsePlanName } from "../../../_lib/diet-base";

/** PUT /api/meal-plans/:id/name — body { name }: renames the meal plan. Returns { id, name }. */
export const onRequestPut: PagesFunction<Env, "id"> = async ({ env, params, request }) => {
  const id = params.id;
  if (!isUuid(id)) return badRequest("Plan id must be a UUID.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const name = parsePlanName(body);
  if (typeof name !== "string") return badRequest(name.error);

  const result = await env.DB.prepare("UPDATE diet_meal_plans SET name = ?, updated_at = ? WHERE id = ?")
    .bind(name, new Date().toISOString(), id)
    .run();
  if (!result.meta.changes) return notFound("Meal plan not found.");

  return json({ id, name });
};
