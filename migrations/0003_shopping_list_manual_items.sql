-- Shopping list items added by hand. See documentation: Modules/Diet/Week plan/Shopping list/Manual items → Data.
ALTER TABLE shopping_list_items ADD COLUMN added_grams REAL;   -- grams added by hand to a product (NULL = none)
ALTER TABLE shopping_list_items ADD COLUMN amount TEXT;        -- own item (product_id "custom-…"): amount as typed, NULL = none
