import { Link } from "react-router";
import "./TrainingScreen.css";

export function TrainingScreen() {
  return (
    <div className="training">
      <h1 className="training-title">Trening</h1>
      <ul className="training-list">
        <li>
          <Link to="/training/profile" className="training-item">
            <span className="training-icon" aria-hidden="true">
              👤
            </span>
            <span className="training-item-label">Profil</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
