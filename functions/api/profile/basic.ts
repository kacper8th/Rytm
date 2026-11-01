import { badRequest, json, type Env } from "../../_lib/http";
import { BASIC_COLUMNS, parseBasicBody, rowToBasic, type BasicDataRow } from "../../_lib/profile";

/** PUT /api/profile/basic — body { birthDate, sex, heightCm }: saves the basic data (replaces it). Returns it as saved. */
export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const basic = parseBasicBody(body);
  if (typeof basic === "string") return badRequest(basic);

  const [, saved] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO profile (id, birth_date, sex, height_cm, updated_at) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET birth_date = excluded.birth_date, sex = excluded.sex,
         height_cm = excluded.height_cm, updated_at = excluded.updated_at`,
    ).bind(basic.birthDate, basic.sex, basic.heightCm, new Date().toISOString()),
    env.DB.prepare(`SELECT ${BASIC_COLUMNS} FROM profile WHERE id = 1`),
  ]);

  return json(rowToBasic((saved.results as BasicDataRow[])[0]));
};
