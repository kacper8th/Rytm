-- Meal plan names are a field of the plan (diet_meal_plans.name) since the Diet base moved to the database,
-- so the table from 0007 is no longer used. See documentation: Modules/Diet/Decision 005 - Diet data in the database.
DROP TABLE meal_plan_names;
0011 usuwająca tabelę meal_plan_names jest gotowa na gałęzi feature/drop-meal-plan-names w obu repozytoriach. Na lokalnej bazie zadziałała: tabeli nie ma, build przechodzi, a API zwraca bazę jak wcześniej. Przed zapisem sprawdziłem, że żaden kod tej tabeli nie używa.

Zmiany:

Kod: nowy plik migrations/0011_drop_meal_plan_