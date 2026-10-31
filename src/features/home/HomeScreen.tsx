import { Card } from "../../shared/ui/Card";
import "./HomeScreen.css";

// SAMPLE DATA — static sketch only. Real data comes with the modules.
const SAMPLE = {
  userName: "Bajda",
  workout: { name: "Siła A", exercises: 5, minutes: 60 },
  habits: [
    { name: "Poranna mobilność", done: true },
    { name: "2 l wody", done: true },
    { name: "Handstand 10 min", done: false },
    { name: "Spacer", done: false },
  ],
  diet: { eatenKcal: 1450, targetKcal: 2600 },
  tasksToday: 3,
  shoppingItems: 7,
};

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

const kcal = new Intl.NumberFormat("pl-PL");

export function HomeScreen() {
  const now = new Date();
  const habitsDone = SAMPLE.habits.filter((h) => h.done).length;
  const dietPercent = Math.min(100, Math.round((SAMPLE.diet.eatenKcal / SAMPLE.diet.targetKcal) * 100));

  return (
    <div className="home">
      <header className="home-header">
        <p className="home-date">{formatDate(now)}</p>
        <h1 className="home-greeting">
          {greeting(now.getHours())}, {SAMPLE.userName} 👋
        </h1>
      </header>

      <div className="home-cards">
        <Card icon="🏋️" title="Trening dziś">
          <p className="home-big">{SAMPLE.workout.name}</p>
          <p className="home-muted">
            {SAMPLE.workout.exercises} ćwiczeń · ~{SAMPLE.workout.minutes} min
          </p>
        </Card>

        <Card icon="✔️" title="Nawyki" badge={`${habitsDone} / ${SAMPLE.habits.length}`}>
          <ul className="home-habits">
            {SAMPLE.habits.map((habit) => (
              <li key={habit.name} className={habit.done ? "is-done" : undefined}>
                <span className="home-check" aria-hidden="true">
                  {habit.done ? "✓" : ""}
                </span>
                {habit.name}
              </li>
            ))}
          </ul>
        </Card>

        <Card icon="🍽️" title="Dieta">
          <p className="home-big">
            {kcal.format(SAMPLE.diet.eatenKcal)}
            <span className="home-muted"> / {kcal.format(SAMPLE.diet.targetKcal)} kcal</span>
          </p>
          <div
            className="home-progress"
            role="progressbar"
            aria-valuenow={dietPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="home-progress-fill" style={{ width: `${dietPercent}%` }} />
          </div>
        </Card>

        <Card icon="📋" title="Zadania dziś" badge={String(SAMPLE.tasksToday)} />

        <Card icon="🛒" title="Lista zakupów" badge={String(SAMPLE.shoppingItems)} />
      </div>
    </div>
  );
}
