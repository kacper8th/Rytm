import { useState } from "react";
import {
  addBodyArea,
  addHealthCondition,
  deleteBodyArea,
  deleteHealthCondition,
  monthLabel,
  renameBodyArea,
  saveHealthCondition,
  type BodyArea,
  type ConditionInput,
  type HealthCondition,
} from "./profile";
import type { SectionProps } from "./ProfileScreen";

/** What is open for editing: one area name, one condition, or the new-condition form of one area. */
type Editing =
  | { kind: "none" }
  | { kind: "area"; id: string }
  | { kind: "condition"; id: string }
  | { kind: "new-condition"; areaId: string };

/**
 * Health conditions grouped by body area (areas in the order they were added). Areas: add, rename, delete — only an
 * empty one. Conditions: add, edit (including moving to another area), delete. Only the current state is kept.
 */
export function HealthSection({ profile, busy, run, update }: SectionProps) {
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const [newArea, setNewArea] = useState("");
  const close = () => setEditing({ kind: "none" });

  function addArea() {
    const name = newArea.trim();
    run(async () => {
      const saved = await addBodyArea(name);
      update((p) => ({ ...p, bodyAreas: [...p.bodyAreas, saved] }));
      setNewArea("");
    });
  }

  function renameArea(id: string, name: string) {
    close();
    run(async () => {
      const saved = await renameBodyArea(id, name);
      update((p) => ({ ...p, bodyAreas: p.bodyAreas.map((a) => (a.id === id ? saved : a)) }));
    });
  }

  function removeArea(area: BodyArea) {
    if (!window.confirm(`Usunąć obszar „${area.name}”?`)) return;
    run(async () => {
      await deleteBodyArea(area.id);
      update((p) => ({ ...p, bodyAreas: p.bodyAreas.filter((a) => a.id !== area.id) }));
    });
  }

  function addCondition(condition: ConditionInput) {
    close();
    run(async () => {
      const saved = await addHealthCondition(condition);
      update((p) => ({ ...p, healthConditions: [...p.healthConditions, saved] }));
    });
  }

  function saveCondition(id: string, condition: ConditionInput) {
    close();
    run(async () => {
      const saved = await saveHealthCondition(id, condition);
      update((p) => ({ ...p, healthConditions: p.healthConditions.map((c) => (c.id === id ? saved : c)) }));
    });
  }

  function removeCondition(condition: HealthCondition) {
    if (!window.confirm(`Usunąć wpis „${condition.description}”?`)) return;
    run(async () => {
      await deleteHealthCondition(condition.id);
      update((p) => ({ ...p, healthConditions: p.healthConditions.filter((c) => c.id !== condition.id) }));
    });
  }

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Stan zdrowia</h2>

      {profile.bodyAreas.length === 0 && <p className="profile-empty">Brak obszarów. Dodaj pierwszy poniżej.</p>}

      {profile.bodyAreas.map((area) => {
        const conditions = profile.healthConditions.filter((c) => c.areaId === area.id);
        return (
          <div key={area.id} className="profile-area">
            {editing.kind === "area" && editing.id === area.id ? (
              <NameForm initial={area.name} busy={busy} onSave={(name) => renameArea(area.id, name)} onCancel={close} />
            ) : (
              <div className="profile-section-header">
                <h3 className="profile-area-title">{area.name}</h3>
                <button
                  type="button"
                  className="profile-icon"
                  disabled={busy}
                  aria-label={`Zmień nazwę: ${area.name}`}
                  onClick={() => setEditing({ kind: "area", id: area.id })}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="profile-icon"
                  disabled={busy || conditions.length > 0}
                  title={conditions.length > 0 ? "Obszar ma wpisy — najpierw je usuń albo przenieś" : undefined}
                  aria-label={`Usuń obszar: ${area.name}`}
                  onClick={() => removeArea(area)}
                >
                  ✕
                </button>
              </div>
            )}

            {conditions.length > 0 && (
              <ul className="profile-list">
                {conditions.map((condition) =>
                  editing.kind === "condition" && editing.id === condition.id ? (
                    <li key={condition.id} className="profile-row">
                      <ConditionForm
                        initial={condition}
                        areas={profile.bodyAreas}
                        busy={busy}
                        onSave={(input) => saveCondition(condition.id, input)}
                        onCancel={close}
                      />
                    </li>
                  ) : (
                    <li key={condition.id} className="profile-row">
                      <div className="profile-row-main">
                        <span>{condition.description}</span>
                        {(condition.source || condition.date) && (
                          <span className="profile-row-meta">
                            {[condition.source, condition.date && monthLabel(condition.date)].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="profile-icon"
                        disabled={busy}
                        aria-label={`Edytuj: ${condition.description}`}
                        onClick={() => setEditing({ kind: "condition", id: condition.id })}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="profile-icon"
                        disabled={busy}
                        aria-label={`Usuń: ${condition.description}`}
                        onClick={() => removeCondition(condition)}
                      >
                        ✕
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}

            {editing.kind === "new-condition" && editing.areaId === area.id ? (
              <ConditionForm
                initial={{ areaId: area.id, description: "", source: null, date: null }}
                areas={profile.bodyAreas}
                busy={busy}
                onSave={addCondition}
                onCancel={close}
              />
            ) : (
              <div className="profile-actions">
                <button
                  type="button"
                  className="profile-button"
                  disabled={busy}
                  onClick={() => setEditing({ kind: "new-condition", areaId: area.id })}
                >
                  Dodaj wpis
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="profile-form is-inline">
        <label className="profile-field is-grow">
          <span>Nowy obszar</span>
          <input
            type="text"
            className="profile-input"
            maxLength={100}
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newArea.trim() && !busy && addArea()}
          />
        </label>
        <button type="button" className="profile-button is-primary" disabled={busy || !newArea.trim()} onClick={addArea}>
          Dodaj obszar
        </button>
      </div>
    </section>
  );
}

type NameFormProps = { initial: string; busy: boolean; onSave: (name: string) => void; onCancel: () => void };

function NameForm({ initial, busy, onSave, onCancel }: NameFormProps) {
  const [name, setName] = useState(initial);
  const trimmed = name.trim();

  return (
    <div className="profile-form is-inline">
      <label className="profile-field is-grow">
        <span>Nazwa obszaru</span>
        <input
          type="text"
          className="profile-input"
          maxLength={100}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="profile-actions">
        <button
          type="button"
          className="profile-button is-primary"
          disabled={busy || !trimmed}
          onClick={() => onSave(trimmed)}
        >
          Zapisz
        </button>
        <button type="button" className="profile-button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

type ConditionFormProps = {
  initial: ConditionInput;
  areas: readonly BodyArea[];
  busy: boolean;
  onSave: (condition: ConditionInput) => void;
  onCancel: () => void;
};

/** Add or edit a condition; the area field moves it to another area. */
function ConditionForm({ initial, areas, busy, onSave, onCancel }: ConditionFormProps) {
  const [areaId, setAreaId] = useState(initial.areaId);
  const [description, setDescription] = useState(initial.description);
  const [source, setSource] = useState(initial.source ?? "");
  const [date, setDate] = useState(initial.date ?? "");
  const trimmed = description.trim();

  return (
    <div className="profile-form">
      <label className="profile-field">
        <span>Obszar</span>
        <select className="profile-input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>
      <label className="profile-field">
        <span>Opis</span>
        <textarea
          className="profile-input"
          rows={3}
          maxLength={1000}
          value={description}
          autoFocus
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="profile-field">
        <span>Źródło (opcjonalnie)</span>
        <input
          type="text"
          className="profile-input"
          maxLength={100}
          placeholder="np. USG"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </label>
      <label className="profile-field">
        <span>Data (opcjonalnie)</span>
        <input type="month" className="profile-input" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="profile-actions">
        <button
          type="button"
          className="profile-button is-primary"
          disabled={busy || !trimmed}
          onClick={() => onSave({ areaId, description: trimmed, source: source.trim() || null, date: date || null })}
        >
          Zapisz
        </button>
        <button type="button" className="profile-button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </div>
  );
}
