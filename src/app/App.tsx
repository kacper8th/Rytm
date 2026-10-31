import { HomeScreen } from "../features/home/HomeScreen";
import "./App.css";

type NavItem = {
  id: string;
  label: string;
  icon: string;
};

// Static sketch: navigation is not wired yet — clicking does nothing.
const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Dziś", icon: "🏠" },
  { id: "diet", label: "Dieta", icon: "🍽️" },
  { id: "training", label: "Trening", icon: "🏋️" },
  { id: "tasks", label: "Zadania", icon: "📋" },
];

const ACTIVE_ID = "home";

export function App() {
  return (
    <div className="app">
      <nav className="app-nav" aria-label="Główna nawigacja">
        <div className="app-brand">Rytm</div>
        <ul className="app-nav-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={"app-nav-item" + (item.id === ACTIVE_ID ? " is-active" : "")}
                aria-current={item.id === ACTIVE_ID ? "page" : undefined}
              >
                <span className="app-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="app-nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="app-content">
        <HomeScreen />
      </main>
    </div>
  );
}
