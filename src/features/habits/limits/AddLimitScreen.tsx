import { Link, useNavigate } from "react-router";
import { HabitForm } from "../HabitForm";
import { addHabit } from "../habits";
import "../Habits.css";

export function AddLimitScreen() {
  const navigate = useNavigate();

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits/limits/list" className="habits-back">
            ← Lista limitów
          </Link>
          <h1 className="habits-title">Nowy limit</h1>
        </div>
      </header>

      <HabitForm
        kind="limit"
        onSave={async (limit) => {
          await addHabit(limit);
          navigate("/habits/limits/list");
        }}
      />
    </div>
  );
}
