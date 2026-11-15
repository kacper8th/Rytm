import { HabitsCard } from "../habits/HabitsCard";
import "./HomeScreen.css";

/** Name in the greeting — the app has one user; there is no name in the profile yet. */
const OWNER_NAME = "Kacper";

function greeting(hour: number): string {
  if (hour < 5 || hour >= 18) return "Dobry wieczór";
  return "Dzień dobry";
}

function formatDate(date: Date): string {
  const text = new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Home screen (today): for now only the Habits card; cards of other modules are added when they are planned. */
export function HomeScreen() {
  const now = new Date();

  return (
    <div className="home">
      <header className="home-header">
        <p className="home-date">{formatDate(now)}</p>
        <h1 className="home-greeting">
          {greeting(now.getHours())}, {OWNER_NAME} 👋
        </h1>
      </header>

      <div className="home-cards">
        <HabitsCard />
      </div>
    </div>
  );
}
