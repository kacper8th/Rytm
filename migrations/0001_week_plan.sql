-- Week plan: one row per saved day. See documentation: Modules/Diet/Week plan → Data.
CREATE TABLE week_plan_days (
  week_start TEXT NOT NULL,                              -- Monday of the week, YYYY-MM-DD
  day INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),      -- 0 = Monday … 6 = Sunday
  items TEXT NOT NULL,                                   -- JSON array of MealPlanItem (snapshot)
  source TEXT,                                           -- JSON {"variantId","planNumber"} or NULL
  updated_at TEXT NOT NULL,                              -- ISO timestamp
  PRIMARY KEY (week_start, day)
);
