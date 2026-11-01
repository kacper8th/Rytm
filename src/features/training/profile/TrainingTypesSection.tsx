import { useState } from "react";
import { addTrainingType, deleteTrainingType } from "./profile";
import type { SectionProps } from "./ProfileScreen";

/** Training types as free text: add and ✕ delete. */
export function TrainingTypesSection({ profile, busy, run, update }: SectionProps) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  function add() {
    run(async () => {
      const saved = await addTrainingType(trimmed);
      update((p) => ({ ...p, trainingTypes: [...p.trainingTypes, saved] }));
      setName("");
    });
  }

  function remove(id: string, typeName: string) {
    if (!window.confirm(`Usunąć rodzaj treningu „${typeName}”?`)) return;
    run(async () => {
      await deleteTrainingType(id);
      update((p) => ({ ...p, trainingTypes: p.trainingTypes.filter((t) => t.id !== id) }));
    });
  }

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Rodzaje treningu</h2>

      {profile.trainingTypes.length === 0 ? (
        <p className="profile-empty">Brak rodzajów treningu.</p>
      ) : (
        <ul className="profile-list">
          {profile.trainingTypes.map((type) => (
            <li key={type.id} className="profile-row">
              <span className="profile-row-main">{type.name}</span>
              <button
                type="button"
                className="profile-icon"
                disabled={busy}
                aria-label={`Usuń: ${type.name}`}
                onClick={() => remove(type.id, type.name)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="profile-form is-inline">
        <label className="profile-field is-grow">
          <span>Nowy rodzaj</span>
          <input
            type="text"
            className="profile-input"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && trimmed && !busy && add()}
          />
        </label>
        <button type="button" className="profile-button is-primary" disabled={busy || !trimmed} onClick={add}>
          Dodaj
        </button>
      </div>
    </section>
  );
}
