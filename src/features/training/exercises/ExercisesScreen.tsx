import { useState } from "react";
import { Link } from "react-router";
import {
  exerciseMatches,
  getEquipment,
  getExercises,
  getExerciseTypes,
  getMuscleGroups,
  type EquipmentId,
  type Exercise,
  type ExerciseFilters,
  type MuscleGroupId,
} from "./exercises";
import "./ExercisesScreen.css";

const collator = new Intl.Collator("pl");

function ExerciseLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="exercises-line">
      <span className="exercises-line-label">{label}:</span> {value}
    </p>
  );
}

export function ExercisesScreen() {
  const [filters, setFilters] = useState<ExerciseFilters>({ muscleGroup: "", equipment: "", type: "" });

  const muscleGroups = getMuscleGroups();
  const equipment = getEquipment();
  const exerciseTypes = getExerciseTypes();
  const groupNames = new Map(muscleGroups.map((group) => [group.id, group.name]));
  const equipmentNames = new Map(equipment.map((item) => [item.id, item.name]));
  const typeNames = new Map(exerciseTypes.map((type) => [type.id, type.name]));

  const exercises = getExercises()
    .filter((exercise) => exerciseMatches(exercise, filters))
    .sort((a, b) => collator.compare(a.name, b.name));

  function groupsOf(ids: readonly MuscleGroupId[]): string {
    return ids.map((id) => groupNames.get(id)).join(", ");
  }

  function equipmentNamesOf(ids: readonly EquipmentId[] = []): string[] {
    return ids.map((id) => equipmentNames.get(id) ?? id);
  }

  /** E.g. "ławka + sztanga, kettlebell lub hantle". */
  function equipmentOf(exercise: Exercise): string {
    const needed = equipmentNamesOf(exercise.equipment).join(", ");
    const options = equipmentNamesOf(exercise.equipmentOptions);
    const last = options.pop();
    const choice = last ? [options.join(", "), last].filter(Boolean).join(" lub ") : "";
    return [needed, choice].filter(Boolean).join(" + ");
  }

  return (
    <div className="exercises">
      <header className="exercises-header">
        <Link to="/training" className="exercises-back">
          ← Trening
        </Link>
        <h1 className="exercises-title">Ćwiczenia</h1>
      </header>

      <div className="exercises-filters">
        <select
          className="exercises-filter"
          aria-label="Filtr partii ciała"
          value={filters.muscleGroup}
          onChange={(e) => setFilters({ ...filters, muscleGroup: e.target.value as ExerciseFilters["muscleGroup"] })}
        >
          <option value="">Partia: wszystkie</option>
          {muscleGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <select
          className="exercises-filter"
          aria-label="Filtr sprzętu"
          value={filters.equipment}
          onChange={(e) => setFilters({ ...filters, equipment: e.target.value as ExerciseFilters["equipment"] })}
        >
          <option value="">Sprzęt: wszystkie</option>
          {equipment.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          className="exercises-filter"
          aria-label="Filtr typu ćwiczenia"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value as ExerciseFilters["type"] })}
        >
          <option value="">Typ: wszystkie</option>
          {exerciseTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      {exercises.length === 0 && <p className="exercises-empty">Brak ćwiczeń.</p>}

      <ul className="exercises-list">
        {exercises.map((exercise) => (
          <li key={exercise.id} className="exercises-item">
            <h2 className="exercises-name">{exercise.name}</h2>
            {exercise.description && <p className="exercises-description">{exercise.description}</p>}
            <ExerciseLine label="Typ" value={typeNames.get(exercise.type) ?? ""} />
            <ExerciseLine label="Główne" value={groupsOf(exercise.main)} />
            {exercise.supporting.length > 0 && (
              <ExerciseLine label="Pomocnicze" value={groupsOf(exercise.supporting)} />
            )}
            <ExerciseLine label="Sprzęt" value={equipmentOf(exercise)} />
            {exercise.variants && (
              <ExerciseLine label="Warianty" value={exercise.variants.map((v) => v.name).join(", ")} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
