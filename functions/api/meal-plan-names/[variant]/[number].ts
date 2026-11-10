import { badRequest, json, type Env } from "../../../_lib/http";
import { parseNameBody, parsePlanNumber, parseVariantId } from "../../../_lib/meal-plan-names";

type Params = "variant" | "number";

/** PUT /api/meal-plan-names/:variant/:number — body { name }: sets the meal plan's name. Returns { variantId, planNumber, name }. */
export const onRequestPut: PagesFunction<Env, Params> = async ({ env, params, request }) => {
  const variantId = parseVariantId(params.variant);
  if (!variantId) return badRequest("Invalid variant id.");
  const planNumber = parsePlanNumber(params.number);
  if (planNumber === null) return badRequest("Plan number must be a whole number greater than 0.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const name = parseNameBody(body);
  if (typeof name !== "string") return badRequest(name.error);

  await env.DB.prepare(
    `INSERT INTO meal_plan_names (variant_id, plan_number, name, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (variant_id, plan_number) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
  )
    .bind(variantId, planNumber, name, new Date().toISOString())
    .run();

  return json({ variantId, planNumber, name });
};
