import { badRequest, notFound, type Env } from "../../../_lib/http";
import { isId } from "../../../_lib/validation";

/** DELETE /api/habits/entries/:entryId — removes one entry; the sum of its day and period goes down by its amount. */
export const onRequestDelete: PagesFunction<Env, "entryId"> = async ({ env, params }) => {
  if (!isId(params.entryId)) return badRequest("Invalid id.");
  const result = await env.DB.prepare("DELETE FROM habit_entries WHERE id = ?").bind(params.entryId).run();
  if (!result.meta.changes) return notFound("Entry not found.");

  return new Response(null, { status: 204 });
};
