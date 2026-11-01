-- Profile (Training): basic data, weight measurements, training types, body areas, health conditions.
-- See documentation: Modules/Training/Profile → Data model.
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),                 -- one row: the owner
  birth_date TEXT NOT NULL,                              -- YYYY-MM-DD
  sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
  height_cm REAL NOT NULL CHECK (height_cm > 0),
  updated_at TEXT NOT NULL                               -- ISO timestamp of the last save of the basic data
);

CREATE TABLE weight_measurements (
  date TEXT PRIMARY KEY,                                 -- YYYY-MM-DD; one measurement per day
  weight_kg REAL NOT NULL CHECK (weight_kg > 0)
);

CREATE TABLE training_types (
  id TEXT PRIMARY KEY,                                   -- random UUID
  name TEXT NOT NULL,
  created_at TEXT NOT NULL                               -- ISO timestamp; list order
);

CREATE TABLE body_areas (
  id TEXT PRIMARY KEY,                                   -- random UUID
  name TEXT NOT NULL,
  created_at TEXT NOT NULL                               -- ISO timestamp; list order (order of adding)
);

CREATE TABLE health_conditions (
  id TEXT PRIMARY KEY,                                   -- random UUID
  area_id TEXT NOT NULL REFERENCES body_areas (id),      -- an area with conditions cannot be deleted
  description TEXT NOT NULL,
  source TEXT,                                           -- e.g. "USG"; NULL = none
  date TEXT,                                             -- YYYY-MM; NULL = none
  created_at TEXT NOT NULL                               -- ISO timestamp; order within the area
);
