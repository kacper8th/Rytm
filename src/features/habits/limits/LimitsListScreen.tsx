import { HabitList } from "../HabitList";

/** All limits, by name; ✎ edits, ✕ deletes the limit with its entries. */
export function LimitsListScreen() {
  return <HabitList kind="limit" />;
}
