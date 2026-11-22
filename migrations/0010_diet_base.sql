-- Diet base in the database: products, meals, meal plan variants and meal plans.
-- Ids are UUIDs; nested parts are JSON (the same shapes as the app types). List order = insert order (rowid).
-- See documentation: Modules/Diet/Decision 005 - Diet data in the database.
CREATE TABLE diet_products (
  id TEXT PRIMARY KEY,                                   -- UUID
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,                                            -- NULL when none
  nutrients TEXT NOT NULL,                               -- JSON {key: number | null}, per 100 g; null = no data
  updated_at TEXT NOT NULL                               -- ISO timestamp
);

CREATE TABLE diet_meals (
  id TEXT PRIMARY KEY,                                   -- UUID
  name TEXT NOT NULL,
  tags TEXT NOT NULL,                                    -- JSON array of meal-time tags
  recipe TEXT,                                           -- text or a link; NULL when none
  ingredients TEXT NOT NULL,                             -- JSON [{productId, grams}]
  gains TEXT NOT NULL,                                   -- JSON {protein|carbs|fat: {max, items: [{productId, grams}]}}
  updated_at TEXT NOT NULL                               -- ISO timestamp
);

CREATE TABLE diet_variants (
  id TEXT PRIMARY KEY,                                   -- UUID
  name TEXT NOT NULL,
  target_kcal REAL NOT NULL CHECK (target_kcal > 0),
  updated_at TEXT NOT NULL                               -- ISO timestamp
);

CREATE TABLE diet_meal_plans (
  id TEXT PRIMARY KEY,                                   -- UUID
  variant_id TEXT NOT NULL REFERENCES diet_variants (id),
  name TEXT NOT NULL,                                    -- 1–100 characters
  items TEXT NOT NULL,                                   -- JSON array of MealPlanItem
  updated_at TEXT NOT NULL                               -- ISO timestamp
);
