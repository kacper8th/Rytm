-- Pantry: products kept at home. See documentation: Modules/Diet/Pantry → Data.
CREATE TABLE pantry_items (
  product_id TEXT PRIMARY KEY,                           -- product id from Products
  grams REAL NOT NULL CHECK (grams > 0),
  updated_at TEXT NOT NULL                               -- ISO timestamp
);

-- Grams of the product in the pantry, for each shopping list item (NULL = not in the pantry).
-- Set when the list is created; kept in sync with the pantry on lists whose range has not ended.
ALTER TABLE shopping_list_items ADD COLUMN pantry_grams REAL CHECK (pantry_grams > 0);
