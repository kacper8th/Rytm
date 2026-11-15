import { Link } from "react-router";
import "./PanelList.css";

/**
 * List of panels on a module's main screen — one panel per sub-module.
 * A panel without `to` (sub-module not built yet) is greyed out, not clickable, with a "coming soon" note.
 */

export type Panel = {
  icon: string;
  /** Name shown on the panel (Polish). */
  label: string;
  /** URL of the sub-module; missing = not built yet. */
  to?: string;
};

export function PanelList({ panels }: { panels: Panel[] }) {
  return (
    <ul className="panel-list">
      {panels.map((panel) => {
        const content = (
          <>
            <span className="panel-list-icon" aria-hidden="true">
              {panel.icon}
            </span>
            <span>{panel.label}</span>
            {!panel.to && <span className="panel-list-note">wkrótce</span>}
          </>
        );
        return (
          <li key={panel.label}>
            {panel.to ? (
              <Link to={panel.to} className="panel-list-item">
                {content}
              </Link>
            ) : (
              <div className="panel-list-item is-disabled" aria-disabled="true">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
