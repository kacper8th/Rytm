import { Link } from "react-router";
import { MODULES } from "../../app/modules";
import { ComingSoon } from "../../shared/ui/ComingSoon";
import "./MoreScreen.css";

/** "Więcej" — modules that are not in the phone's bottom bar. */
export function MoreScreen() {
  const modules = MODULES.filter((m) => !m.inBottomBar);

  if (modules.length === 0) {
    return <ComingSoon icon="☰" title="Więcej" text="Tu pojawią się kolejne moduły." />;
  }

  return (
    <div className="more">
      <h1 className="more-title">Więcej</h1>
      <ul className="more-list">
        {modules.map((m) => (
          <li key={m.id}>
            <Link to={m.path} className="more-item">
              <span className="more-icon" aria-hidden="true">
                {m.icon}
              </span>
              {m.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
