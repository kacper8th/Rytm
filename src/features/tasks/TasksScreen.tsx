import { Link } from "react-router";
import "./Tasks.css";

/** Main screen of Tasks: the three panels. A panel without a screen yet is shown greyed out, not clickable. */
export function TasksScreen() {
  return (
    <div className="tasks">
      <h1 className="tasks-title tasks-hub-title">Zadania</h1>
      <ul className="tasks-hub">
        <li>
          <Link to="/tasks/current" className="tasks-hub-item">
            <span className="tasks-hub-icon" aria-hidden="true">
              📅
            </span>
            <span>Aktualne zadania</span>
          </Link>
        </li>
        <li>
          <div className="tasks-hub-item is-disabled" aria-disabled="true">
            <span className="tasks-hub-icon" aria-hidden="true">
              📝
            </span>
            <span>Zadania</span>
            <span className="tasks-hub-note">wkrótce</span>
          </div>
        </li>
        <li>
          <Link to="/tasks/recurring" className="tasks-hub-item">
            <span className="tasks-hub-icon" aria-hidden="true">
              🔁
            </span>
            <span>Zadania cykliczne</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
