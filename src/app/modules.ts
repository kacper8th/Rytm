import type { ComponentType } from "react";
import type { RouteObject } from "react-router";
import { HomeScreen } from "../features/home/HomeScreen";
import { DietScreen } from "../features/diet/DietScreen";
import { ProductsScreen } from "../features/diet/products/ProductsScreen";
import { MealsScreen } from "../features/diet/meals/MealsScreen";
import { MealPlansScreen } from "../features/diet/meal-plans/MealPlansScreen";
import { WeekPlanScreen } from "../features/diet/week-plan/WeekPlanScreen";
import { TodayMenuScreen } from "../features/diet/week-plan/today-menu/TodayMenuScreen";
import { WeekStatisticsScreen } from "../features/diet/week-plan/week-statistics/WeekStatisticsScreen";
import { ShoppingListsScreen } from "../features/diet/week-plan/shopping-list/ShoppingListsScreen";
import { NewShoppingListScreen } from "../features/diet/week-plan/shopping-list/NewShoppingListScreen";
import { ShoppingListScreen } from "../features/diet/week-plan/shopping-list/ShoppingListScreen";
import { AddItemScreen } from "../features/diet/week-plan/shopping-list/manual-items/AddItemScreen";
import { PantryScreen } from "../features/diet/pantry/PantryScreen";
import { AddPantryItemScreen } from "../features/diet/pantry/AddPantryItemScreen";
import { TrainingScreen } from "../features/training/TrainingScreen";
import { ExercisesScreen } from "../features/training/exercises/ExercisesScreen";
import { ProfileScreen } from "../features/training/profile/ProfileScreen";
import { WeightHistoryScreen } from "../features/training/profile/weight-history/WeightHistoryScreen";
import { TasksScreen } from "../features/tasks/TasksScreen";

/**
 * Module registry — the single place where top-level modules are added.
 * The router and both menus (phone bottom bar, PC side panel) are built from this list.
 * See documentation: Decisions/Decision 001 - Navigation.
 */
export type AppModule = {
  /** Stable id, also used as React key. */
  id: string;
  /** Name shown in the menu (Polish). */
  label: string;
  /** Menu icon. */
  icon: string;
  /** URL of the module's main screen, in English, e.g. "/diet". */
  path: string;
  /** Main screen of the module. */
  Screen: ComponentType;
  /** true = shown in the phone's bottom bar; false = listed under "Więcej". PC always shows all. */
  inBottomBar: boolean;
  /** Optional sub-screens, relative to `path`, e.g. { path: "products", element: <ProductsScreen /> }. */
  subRoutes?: RouteObject[];
};

export const MODULES: AppModule[] = [
  { id: "home", label: "Dziś", icon: "🏠", path: "/", Screen: HomeScreen, inBottomBar: true },
  {
    id: "diet",
    label: "Dieta",
    icon: "🍽️",
    path: "/diet",
    Screen: DietScreen,
    inBottomBar: true,
    subRoutes: [
      { path: "today", Component: TodayMenuScreen },
      { path: "products", Component: ProductsScreen },
      { path: "meals", Component: MealsScreen },
      { path: "meal-plans", Component: MealPlansScreen },
      { path: "week-plan", Component: WeekPlanScreen },
      { path: "week-plan/statistics", Component: WeekStatisticsScreen },
      { path: "shopping-lists", Component: ShoppingListsScreen },
      { path: "shopping-lists/new", Component: NewShoppingListScreen },
      { path: "shopping-lists/:id", Component: ShoppingListScreen },
      { path: "shopping-lists/:id/add", Component: AddItemScreen },
      { path: "pantry", Component: PantryScreen },
      { path: "pantry/add", Component: AddPantryItemScreen },
    ],
  },
  {
    id: "training",
    label: "Trening",
    icon: "🏋️",
    path: "/training",
    Screen: TrainingScreen,
    inBottomBar: true,
    subRoutes: [
      { path: "profile", Component: ProfileScreen },
      { path: "profile/weight-history", Component: WeightHistoryScreen },
      { path: "exercises", Component: ExercisesScreen },
    ],
  },
  { id: "tasks", label: "Zadania", icon: "📋", path: "/tasks", Screen: TasksScreen, inBottomBar: true },
];

/** "Więcej" entry in the phone's bottom bar — lists modules that are not in the bar. */
export const MORE_ITEM = { id: "more", label: "Więcej", icon: "☰", path: "/more" } as const;
