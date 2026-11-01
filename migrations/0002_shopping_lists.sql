-- Shopping lists: a snapshot made when the list is created. See documentation: Modules/Diet/Week plan/Shopping list → Data.
CREATE TABLE shopping_lists (
  id TEXT PRIMARY KEY,                                   -- random UUID
  date_from TEXT NOT NULL,                               -- first day of the range, YYYY-MM-DD
  date_to TEXT NOT NULL,                                 -- last day of the range, YYYY-MM-DD
  planned_days INTEGER NOT NULL,                         -- days of the range that had a plan
  created_at TEXT NOT NULL                               -- ISO timestamp
);

CREATE TABLE shopping_list_items (
  list_id TEXT NOT NULL REFERENCES shopping_lists (id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,                                    -- copied from Products when the list was created
  category TEXT NOT NULL,                                -- copied from Products when the list was created
  days TEXT NOT NULL,                                    -- JSON {"YYYY-MM-DD": grams}
  checked INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0, 1)),
  PRIMARY KEY (list_id, product_id)
);
