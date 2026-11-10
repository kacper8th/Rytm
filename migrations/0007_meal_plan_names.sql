-- Meal plan names: one row per meal plan the user renamed. A plan without a row has the default name.
-- See documentation: Modules/Diet/Meal plans → Names.
CREATE TABLE meal_plan_names (
  variant_id TEXT NOT NULL,                              -- variant id (slug of the variant name), e.g. "2800-kcal"
  plan_number INTEGER NOT NULL CHECK (plan_number > 0),  -- meal plan number from the CSV
  name TEXT NOT NULL,                                    -- 1–100 characters
  updated_at TEXT NOT NULL,                              -- ISO timestamp
  PRIMARY KEY (variant_id, plan_number)
);
