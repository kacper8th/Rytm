import { useState } from "react";
import { ageFrom, dateLabel, number, saveBasicData, SEX_LABELS, today, type BasicData, type Sex } from "./profile";
import type { SectionProps } from "./ProfileScreen";

/** "34 lata", "35 lat", "1 rok". */
function yearsLabel(years: number): string {
  if (years === 1) return "1 rok";
  const lastDigit = years % 10;
  const lastTwo = years % 100;
  return `${years} ${lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? "lata" : "lat"}`;
}

/** Date of birth (with age), sex, height; edit mode shows them as a form. Weight is in WeightSection. */
export function BasicDataSection({ profile, editMode, busy, run, update }: SectionProps) {
  const { basic } = profile;

  function save(data: Omit<BasicData, "updatedAt">) {
    run(async () => {
      const saved = await saveBasicData(data);
      update((p) => ({ ...p, basic: saved }));
    });
  }

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Dane podstawowe</h2>

      {editMode ? (
        <BasicDataForm basic={basic} busy={busy} onSave={save} />
      ) : (
        <dl className="profile-list profile-facts">
          <div className="profile-row">
            <dt>Data urodzenia</dt>
            <dd>{basic ? `${dateLabel(basic.birthDate)} (${yearsLabel(ageFrom(basic.birthDate))})` : "—"}</dd>
          </div>
          <div className="profile-row">
            <dt>Płeć</dt>
            <dd>{basic ? SEX_LABELS[basic.sex] : "—"}</dd>
          </div>
          <div className="profile-row">
            <dt>Wzrost</dt>
            <dd>{basic ? `${number.format(basic.heightCm)} cm` : "—"}</dd>
          </div>
        </dl>
      )}

      {basic && !editMode &&<p className="profile-hint">Zaktualizowano: {dateLabel(basic.updatedAt)}</p>}
    </section>
  );
}

type FormProps = {
  basic: BasicData | null;
  busy: boolean;
  onSave: (data: Omit<BasicData, "updatedAt">) => void;
};

/** Stays open after saving; leaving edit mode drops unsaved changes. */
function BasicDataForm({ basic, busy, onSave }: FormProps) {
  const [birthDate, setBirthDate] = useState(basic?.birthDate ?? "");
  const [sex, setSex] = useState<Sex | "">(basic?.sex ?? "");
  const [height, setHeight] = useState(basic ? String(basic.heightCm) : "");
  const heightCm = Number(height.replace(",", "."));
  const valid = birthDate !== "" && birthDate <= today() && sex !== "" && heightCm >= 50 && heightCm <= 250;

  return (
    <div className="profile-form">
      <label className="profile-field">
        <span>Data urodzenia</span>
        <input
          type="date"
          className="profile-input"
          max={today()}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </label>
      <label className="profile-field">
        <span>Płeć</span>
        <select className="profile-input" value={sex} onChange={(e) => setSex(e.target.value as Sex | "")}>
          <option value="">—</option>
          {(Object.keys(SEX_LABELS) as Sex[]).map((key) => (
            <option key={key} value={key}>
              {SEX_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
      <label className="profile-field">
        <span>Wzrost (cm)</span>
        <input
          type="number"
          inputMode="decimal"
          min="50"
          max="250"
          className="profile-input"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
      </label>
      <div className="profile-actions">
        <button
          type="button"
          className="profile-button is-primary"
          disabled={busy || !valid}
          onClick={() => sex !== "" && onSave({ birthDate, sex, heightCm })}
        >
          Zapisz
        </button>
      </div>
    </div>
  );
}
