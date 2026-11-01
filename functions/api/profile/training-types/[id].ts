import { badRequest, notFound, type Env } from "../../../_lib/http";
import { isId } from "../../../_lib/profile";

/** DELETE /api/profile/training-types/:id — removes a training type. */
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  if (!isId(params.id)) return badRequest("Invalid id.");
  const result = await env.DB.prepare("DELETE FROM training_types WHERE id = ?").bind(params.id).run();
  if (!result.meta.changes) return notFound("Training type not found.");

  return new Response(null, { status: 204 });
};
