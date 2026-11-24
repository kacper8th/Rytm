import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { isUuid } from "../../../_lib/diet-base";

/**
 * DELETE /api/meal-plans/:id — deletes the meal plan. Nothing in the base refers to a plan; week plan days are copies
 * of its items and keep them. Returns { id }.
 */
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  const id = params.id;
  if (!isUuid(id)) return badRequest("Plan id must be a UUID.");

  const result = await env.DB.prepare("DELETE FROM diet_meal_plans WHERE id = ?").bind(id).run();
  if (!result.meta.changes) return notFound("Meal plan not found.");

  return json({ id });
};
