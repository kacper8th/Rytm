import { NavLink, Outlet, ScrollRestoration } from "react-router";
import { MODULES, MORE_ITEM } from "./modules";
import "./App.css";

type NavEntry = {
  id: string;
  label: string;
  icon: string;
  path: string;
  /** Extra CSS class controlling where the entry is visible. */
  visibility?: "phone-hidden" | "pc-hidden";
};

// Phone: modules from the bottom bar + "Więcej". PC: all modules, no "Więcej".
const NAV_ENTRIES: NavEntry[] = [
  ...MODULES.map((m) => ({
    id: m.id,
    label: m.label,
    icon: m.icon,
    path: m.path,
    visibility: m.inBottomBar ? undefined : ("phone-hidden" as const),
  })),
  { ...MORE_ITEM, visibility: "pc-hidden" },
];

export function App() {
  return (
    <div className="app">
      <nav className="app-nav" aria-label="Główna nawigacja">
        <div className="app-brand">Rytm</div>
        <ul className="app-nav-list">
          {NAV_ENTRIES.map((entry) => (
            <li key={entry.id} className={entry.visibility ? `is-${entry.visibility}` : undefined}>
              <NavLink
                to={entry.path}
                end={entry.path === "/"}
                className={({ isActive }) => "app-nav-item" + (isActive ? " is-active" : "")}
              >
                <span className="app-nav-icon" aria-hidden="true">
                  {entry.icon}
                </span>
                <span className="app-nav-label">{entry.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="app-content">
        <Outlet />
      </main>

      <ScrollRestoration />
    </div>
  );
}
