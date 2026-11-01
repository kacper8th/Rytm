import { useState } from "react";
import { dateLabel, deleteWeight, number, saveWeight, today } from "./profile";
import type { SectionProps } from "./ProfileScreen";

/** Weight measurements, newest first: add (one per day — a second one replaces it) and ✕ delete. */
export function WeightSection({ profile, busy, run, update }: SectionProps) {
  const [date, setDate] = useState(today());
  const [weight, setWeight] = useState("");
  const weightKg = Number(weight.replace(",", "."));
  const valid = date !== "" && date <= today() && weightKg >= 20 && weightKg <= 300;
  const replaces = profile.weights.some((w) => w.date === date);

  function save() {
    run(async () => {
      const saved = await saveWeight(date, weightKg);
      update((p) => ({
        ...p,
        weights: [...p.weights.filter((w) => w.date !== saved.date), saved].sort((a, b) => b.date.localeCompare(a.date)),
      }));
      setWeight("");
    });
  }

  function remove(day: string) {
    if (!window.confirm(`Usunąć pomiar wagi z ${dateLabel(day)}?`)) return;
    run(async () => {
      await deleteWeight(day);
      update((p) => ({ ...p, weights: p.weights.filter((w) => w.date !== day) }));
    });
  }

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Waga</h2>

      <div className="profile-form is-inline">
        <label className="profile-field">
          <span>Dzień</span>
          <input
            type="date"
            className="profile-input"
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="profile-field">
          <span>Waga (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            min="20"
            max="300"
            step="0.1"
            className="profile-input"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <button type="button" className="profile-button is-primary" disabled={busy || !valid} onClick={save}>
          {replaces ? "Zastąp pomiar" : "Dodaj pomiar"}
        </button>
      </div>

      {profile.weights.length === 0 ? (
        <p className="profile-empty">Brak pomiarów.</p>
      ) : (
        <ul className="profile-list">
          {profile.weights.map((w) => (
            <li key={w.date} className="profile-row">
              <span className="profile-row-main">{dateLabel(w.date)}</span>
              <span>{number.format(w.weightKg)} kg</span>
              <button
                type="button"
                className="profile-icon"
                disabled={busy}
                aria-label={`Usuń pomiar z ${dateLabel(w.date)}`}
                onClick={() => remove(w.date)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
