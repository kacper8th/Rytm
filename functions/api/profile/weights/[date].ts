import { badRequest, json, notFound, type Env } from "../../../_lib/http";
import { parseDate, parseWeightBody } from "../../../_lib/profile";

/** PUT /api/profile/weights/:date — body { weightKg }: saves the measurement of that day (replaces an earlier one). */
export const onRequestPut: PagesFunction<Env, "date"> = async ({ env, params, request }) => {
  const date = parseDate(params.date);
  if (!date) return badRequest("Invalid date.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const weightKg = parseWeightBody(body);
  if (typeof weightKg === "string") return badRequest(weightKg);

  await env.DB.prepare(
    `INSERT INTO weight_measurements (date, weight_kg) VALUES (?, ?)
     ON CONFLICT (date) DO UPDATE SET weight_kg = excluded.weight_kg`,
  )
    .bind(date, weightKg)
    .run();

  return json({ date, weightKg });
};

/** DELETE /api/profile/weights/:date — removes the measurement of that day. */
export const onRequestDelete: PagesFunction<Env, "date"> = async ({ env, params }) => {
  const date = parseDate(params.date);
  if (!date) return badRequest("Invalid date.");
  const result = await env.DB.prepare("DELETE FROM weight_measurements WHERE date = ?").bind(date).run();
  if (!result.meta.changes) return notFound("No measurement on that day.");

  return new Response(null, { status: 204 });
};
