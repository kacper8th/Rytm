import { json, type Env } from "../../_lib/http";
import {
  BASIC_COLUMNS,
  CONDITION_COLUMNS,
  NAMED_COLUMNS,
  rowToBasic,
  rowToCondition,
  rowToWeight,
  WEIGHT_COLUMNS,
  type BasicDataRow,
  type HealthConditionRow,
  type NamedRow,
  type WeightMeasurementRow,
} from "../../_lib/profile";

/**
 * GET /api/profile — the whole profile: basic data (null until first saved), weight measurements (newest first),
 * training types, body areas and health conditions (in the order they were added).
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [basic, weights, trainingTypes, bodyAreas, conditions] = await env.DB.batch([
    env.DB.prepare(`SELECT ${BASIC_COLUMNS} FROM profile WHERE id = 1`),
    env.DB.prepare(`SELECT ${WEIGHT_COLUMNS} FROM weight_measurements ORDER BY date DESC`),
    env.DB.prepare(`SELECT ${NAMED_COLUMNS} FROM training_types ORDER BY created_at`),
    env.DB.prepare(`SELECT ${NAMED_COLUMNS} FROM body_areas ORDER BY created_at`),
    env.DB.prepare(`SELECT ${CONDITION_COLUMNS} FROM health_conditions ORDER BY created_at`),
  ]);
  const basicRow = (basic.results as BasicDataRow[])[0];

  return json({
    basic: basicRow ? rowToBasic(basicRow) : null,
    weights: (weights.results as WeightMeasurementRow[]).map(rowToWeight),
    trainingTypes: trainingTypes.results as NamedRow[],
    bodyAreas: bodyAreas.results as NamedRow[],
    healthConditions: (conditions.results as HealthConditionRow[]).map(rowToCondition),
  });
};
