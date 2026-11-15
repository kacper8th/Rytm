-- Habits: goals (at least), limits (at most) and counters (days since the start or the last restart).
-- See documentation: Modules/Habits.

-- One row per goal, limit or counter. Columns not used by the kind (or by the goal's schedule) are NULL.
CREATE TABLE habits (
  id TEXT PRIMARY KEY,                                     -- random UUID
  kind TEXT NOT NULL CHECK (kind IN ('goal', 'limit', 'counter')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  start_date TEXT NOT NULL,                                -- YYYY-MM-DD; counter: start of the first run
  schedule TEXT CHECK (schedule IN ('rule', 'period')),    -- goal: by repeat rule or by period
  repeat_type TEXT CHECK (repeat_type IN ('days', 'weekly', 'month_day', 'month_weekday')), -- goal with a rule
  interval INTEGER CHECK (interval >= 1),                  -- every N days (days) / every N weeks (weekly)
  weekdays TEXT,                                           -- weekly: days 0 = Monday … 6 = Sunday, e.g. "0,3"
  month_day INTEGER CHECK (month_day BETWEEN 1 AND 28),    -- month_day: day number
  week_of_month INTEGER CHECK (week_of_month IN (1, 2, 3, 4, -1)), -- month_weekday: 1st–4th, -1 = last
  weekday INTEGER CHECK (weekday BETWEEN 0 AND 6),         -- month_weekday: 0 = Monday … 6 = Sunday
  period TEXT CHECK (period IN ('day', 'week', 'month')),  -- goal with a period, limit
  target REAL,                                             -- goal: at least (> 0); limit: at most (>= 0)
  unit TEXT CHECK (length(unit) BETWEEN 1 AND 20),         -- free text, e.g. "ml", "razy"
  button_values TEXT,                                      -- amounts of the quick buttons, e.g. "100,250,0.5"
  created_at TEXT NOT NULL,                                -- ISO timestamp
  CHECK (
    (kind = 'goal' AND target > 0 AND unit IS NOT NULL AND button_values IS NOT NULL AND (
      (schedule = 'rule' AND repeat_type IS NOT NULL AND interval IS NOT NULL AND period IS NULL) OR
      (schedule = 'period' AND repeat_type IS NULL AND period IS NOT NULL)))
    OR (kind = 'limit' AND target >= 0 AND unit IS NOT NULL AND button_values IS NOT NULL
      AND schedule IS NULL AND repeat_type IS NULL AND period IS NOT NULL)
    OR (kind = 'counter' AND schedule IS NULL AND repeat_type IS NULL AND period IS NULL
      AND target IS NULL AND unit IS NULL AND button_values IS NULL)
  )
);

-- Goals and limits: one row per click on a quick button or per amount typed by hand.
-- Deleting a row lowers the sum of its day; deleting a habit deletes its rows.
CREATE TABLE habit_entries (
  id TEXT PRIMARY KEY,                                     -- random UUID
  habit_id TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
  date TEXT NOT NULL,                                      -- YYYY-MM-DD the entry counts for
  amount REAL NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL                                 -- ISO timestamp; "undo last" deletes the newest of a day
);
CREATE INDEX habit_entries_date ON habit_entries (date);
CREATE INDEX habit_entries_habit ON habit_entries (habit_id, date);

-- Counters: one row per run. A restart on day D ends the current run on D and starts a new one on D;
-- undoing it deletes the newest run and opens the previous one again. Deleting a habit deletes its rows.
CREATE TABLE counter_runs (
  id TEXT PRIMARY KEY,                                     -- random UUID
  habit_id TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,                                -- YYYY-MM-DD
  end_date TEXT                                            -- YYYY-MM-DD; NULL = the current run
);
CREATE INDEX counter_runs_habit ON counter_runs (habit_id, start_date);
CREATE UNIQUE INDEX counter_runs_current ON counter_runs (habit_id) WHERE end_date IS NULL;
