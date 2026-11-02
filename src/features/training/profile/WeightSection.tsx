import { useState } from "react";
import { Link } from "react-router";
import { dateLabel, number, saveWeight, today } from "./profile";
import type { SectionProps } from "./ProfileScreen";

/** The latest measurement and adding one (one per day — a second one replaces it); the rest is in Weight history. */
export function WeightSection({ profile, busy, run, update }: SectionProps) {
  const latest = profile.weights[0];
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

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Waga</h2>

      {latest ? (
        <dl className="profile-list profile-facts">
          <div className="profile-row">
            <dt>Ostatni pomiar</dt>
            <dd>
              {number.format(latest.weightKg)} kg ({dateLabel(latest.date)})
            </dd>
          </div>
        </dl>
      ) : (
        <p className="profile-empty">Brak pomiarów.</p>
      )}

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

      {latest && (
        <Link to="/training/profile/weight-history" className="profile-button">
          Pokaż historię pomiarów
        </Link>
      )}
    </section>
  );
}
