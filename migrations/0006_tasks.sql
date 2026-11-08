-- Tasks: recurring tasks and the occurrences marked as done. See documentation: Modules/Tasks.
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,                                     -- random UUID
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  repeat_type TEXT NOT NULL CHECK (repeat_type IN ('days', 'weekly', 'month_day', 'month_weekday')),
  start_date TEXT NOT NULL,                                -- YYYY-MM-DD, first possible occurrence
  interval INTEGER NOT NULL DEFAULT 1 CHECK (interval >= 1), -- every N days (days) / every N weeks (weekly)
  weekdays TEXT,                                           -- weekly: days 0 = Monday … 6 = Sunday, e.g. "0,3"
  month_day INTEGER CHECK (month_day BETWEEN 1 AND 28),    -- month_day: day number
  week_of_month INTEGER CHECK (week_of_month IN (1, 2, 3, 4, -1)), -- month_weekday: 1st–4th, -1 = last
  weekday INTEGER CHECK (weekday BETWEEN 0 AND 6),         -- month_weekday: 0 = Monday … 6 = Sunday
  created_at TEXT NOT NULL                                 -- ISO timestamp
);

-- One row = one occurrence marked as done; unmarking deletes the row. Deleting a task deletes its history.
CREATE TABLE task_completions (
  task_id TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  date TEXT NOT NULL,                                      -- YYYY-MM-DD of the occurrence
  done_at TEXT NOT NULL,                                   -- ISO timestamp
  PRIMARY KEY (task_id, date)
);
