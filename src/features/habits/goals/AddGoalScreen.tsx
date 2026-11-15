import { Link, useNavigate } from "react-router";
import { HabitForm } from "../HabitForm";
import { addHabit } from "../habits";
import "../Habits.css";

export function AddGoalScreen() {
  const navigate = useNavigate();

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits/goals/list" className="habits-back">
            ← Lista celów
          </Link>
          <h1 className="habits-title">Nowy cel</h1>
        </div>
      </header>

      <HabitForm
        kind="goal"
        onSave={async (goal) => {
          await addHabit(goal);
          navigate("/habits/goals/list");
        }}
      />
    </div>
  );
}
