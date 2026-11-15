import { PanelList } from "../../shared/ui/PanelList";
import "./Habits.css";

/** Main screen of Habits: one panel per sub-module. See documentation: Modules/Habits. */
export function HabitsScreen() {
  return (
    <div className="habits">
      <h1 className="habits-title">Nawyki</h1>
      <PanelList
        panels={[
          { icon: "🎯", label: "Cele", to: "/habits/goals" },
          { icon: "🚫", label: "Limity" },
          { icon: "⏱️", label: "Liczniki" },
          { icon: "📊", label: "Statystyki" },
        ]}
      />
    </div>
  );
}
