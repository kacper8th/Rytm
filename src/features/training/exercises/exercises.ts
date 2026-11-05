import { EQUIPMENT, EXERCISE_TYPES, EXERCISES, MUSCLE_GROUPS } from "./exercises.data";

/**
 * Exercises — fixed data kept in exercises.data.ts.
 * See documentation: Modules/Training/Exercises, Decisions/Decision 002 - Data.
 */

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type MuscleGroupId = MuscleGroup["id"];

export type Equipment = (typeof EQUIPMENT)[number];
export type EquipmentId = Equipment["id"];

export type ExerciseType = (typeof EXERCISE_TYPES)[number];
export type ExerciseTypeId = ExerciseType["id"];

/** Another way of doing the exercise; muscle groups and equipment come from the exercise. */
export type Variant = {
  /** Unique within its exercise; saved data will refer to the exercise id + this id. */
  id: string;
  /** Name shown in the interface (Polish). */
  name: string;
};

/** At least one of the two: what is always needed, and what to choose from. */
type ExerciseEquipment =
  | {
      /** The exercise uses all of them. */
      equipment: readonly [EquipmentId, ...EquipmentId[]];
      /** The exercise uses one of them. */
      equipmentOptions?: readonly [EquipmentId, EquipmentId, ...EquipmentId[]];
    }
  | {
      equipment?: undefined;
      equipmentOptions: readonly [EquipmentId, EquipmentId, ...EquipmentId[]];
    };

export type Exercise = ExerciseEquipment & {
  /** Stable — saved data will refer to an exercise by this id, so never change it. */
  id: string;
  /** Name shown in the interface (Polish). */
  name: string;
  type: ExerciseTypeId;
  /** Short reminder of the technique, 1–3 sentences (Polish). */
  description?: string;
  /** At least one group. */
  main: readonly [MuscleGroupId, ...MuscleGroupId[]];
  supporting: readonly MuscleGroupId[];
  variants?: readonly Variant[];
};

/** An empty value means "all". */
export type ExerciseFilters = {
  muscleGroup: MuscleGroupId | "";
  equipment: EquipmentId | "";
  type: ExerciseTypeId | "";
};

export function getExercises(): readonly Exercise[] {
  return EXERCISES;
}

export function getMuscleGroups(): readonly MuscleGroup[] {
  return MUSCLE_GROUPS;
}

export function getEquipment(): readonly Equipment[] {
  return EQUIPMENT;
}

export function getExerciseTypes(): readonly ExerciseType[] {
  return EXERCISE_TYPES;
}

/** All filters must match; each filter accepts every list of its kind (main and supporting, needed and optional). */
export function exerciseMatches(exercise: Exercise, filters: ExerciseFilters): boolean {
  const { muscleGroup, equipment, type } = filters;
  if (muscleGroup && ![...exercise.main, ...exercise.supporting].includes(muscleGroup)) return false;
  if (equipment && ![...(exercise.equipment ?? []), ...(exercise.equipmentOptions ?? [])].includes(equipment)) {
    return false;
  }
  if (type && exercise.type !== type) return false;
  return true;
}
