import type { ComponentType } from "react";
import type { RouteObject } from "react-router";
import { HomeScreen } from "../features/home/HomeScreen";
import { DietScreen } from "../features/diet/DietScreen";
import { ProductsScreen } from "../features/diet/products/ProductsScreen";
import { MealsScreen } from "../features/diet/meals/MealsScreen";
import { MealPlansScreen } from "../features/diet/meal-plans/MealPlansScreen";
import { WeekPlanScreen } from "../features/diet/week-plan/WeekPlanScreen";
import { WeekStatisticsScreen } from "../features/diet/week-statistics/WeekStatisticsScreen";
import { TrainingScreen } from "../features/training/TrainingScreen";
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
      { path: "products", Component: ProductsScreen },
      { path: "meals", Component: MealsScreen },
      { path: "meal-plans", Component: MealPlansScreen },
      { path: "week-plan", Component: WeekPlanScreen },
      { path: "week-plan/statistics", Component: WeekStatisticsScreen },
    ],
  },
  { id: "training", label: "Trening", icon: "🏋️", path: "/training", Screen: TrainingScreen, inBottomBar: true },
  { id: "tasks", label: "Zadania", icon: "📋", path: "/tasks", Screen: TasksScreen, inBottomBar: true },
];

/** "Więcej" entry in the phone's bottom bar — lists modules that are not in the bar. */
export const MORE_ITEM = { id: "more", label: "Więcej", icon: "☰", path: "/more" } as const;
