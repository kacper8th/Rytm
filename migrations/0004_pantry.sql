-- Pantry: products kept at home. See documentation: Modules/Diet/Pantry → Data.
CREATE TABLE pantry_items (
  product_id TEXT PRIMARY KEY,                           -- product id from Products
  grams REAL NOT NULL CHECK (grams > 0),                 -- saved, but does not change shopping lists yet
  updated_at TEXT NOT NULL                               -- ISO timestamp
);

-- Shopping list items whose product was in the pantry when the list was created (snapshot).
ALTER TABLE shopping_list_items ADD COLUMN in_pantry INTEGER NOT NULL DEFAULT 0 CHECK (in_pantry IN (0, 1));
