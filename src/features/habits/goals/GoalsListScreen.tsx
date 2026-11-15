import { HabitList } from "../HabitList";

/** All goals, by name; ✎ edits, ✕ deletes the goal with its entries. */
export function GoalsListScreen() {
  return <HabitList kind="goal" />;
}
