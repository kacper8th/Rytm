import { badRequest, json, type Env } from "../../_lib/http";
import { parseSettings, rowToSettings, type SettingsRow } from "../../_lib/habits";

/** GET /api/habits/settings — settings of the Habits card on Home (the defaults when none are saved). */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const row = await env.DB.prepare("SELECT home_range, home_days, home_show_all FROM habit_settings WHERE id = 1").first<SettingsRow>();
  return json(rowToSettings(row));
};

/** PUT /api/habits/settings — body: homeRange, homeDays, homeShowAll. Saves all of them. Returns the settings. */
export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }
  const settings = parseSettings(body);
  if (typeof settings === "string") return badRequest(settings);

  await env.DB.prepare(
    `INSERT INTO habit_settings (id, home_range, home_days, home_show_all, updated_at) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET home_range = excluded.home_range, home_days = excluded.home_days,
       home_show_all = excluded.home_show_all, updated_at = excluded.updated_at`,
  )
    .bind(settings.homeRange, settings.homeDays, settings.homeShowAll ? 1 : 0, new Date().toISOString())
    .run();

  return json(settings);
};
