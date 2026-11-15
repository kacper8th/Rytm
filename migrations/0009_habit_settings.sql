-- Habits settings, shared by all devices: what the Habits card on Home shows. See documentation: Modules/Habits/Settings.
-- At most one row (id = 1); without a row the defaults apply (range = month, show all = off).
CREATE TABLE habit_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  home_range TEXT NOT NULL CHECK (home_range IN ('day', 'days', 'week', 'month')), -- today / N days / this week / this month
  home_days INTEGER NOT NULL CHECK (home_days BETWEEN 2 AND 31),                 -- N for 'days': today + N-1 next days
  home_show_all INTEGER NOT NULL CHECK (home_show_all IN (0, 1)),                -- 1 = Home shows all habits
  updated_at TEXT NOT NULL                                                        -- ISO timestamp
);
