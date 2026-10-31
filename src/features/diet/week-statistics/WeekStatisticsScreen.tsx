import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { number } from "../meals/MealDetails";
import { isOffTarget, TARGET_TOLERANCE } from "../meal-plans/meal-plans";
import { NUTRIENT_GROUPS, NUTRIENTS, type NutrientKey } from "../products/products";
import { DAYS_IN_WEEK, getWeekPlan, weekFromParam, weekLabel, type WeekPlan } from "../week-plan/week-plan";
import { NORM_PROFILE, NORMS } from "./norms";
import { weekStatistics, type EnergyMacro, type WeekStatistics } from "./week-statistics";
import "../meals/MealsScreen.css";
import "../meal-plans/MealPlansScreen.css";
import "../week-plan/WeekPlanScreen.css";
import "./WeekStatisticsScreen.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; plan: WeekPlan };

const signed = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1, signDisplay: "exceptZero" });
const percent = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });

const ENERGY_MACROS: EnergyMacro[] = ["protein", "fat", "carbs"];

export function WeekStatisticsScreen() {
  const [params] = useSearchParams();
  const weekStart = weekFromParam(params.get("week"));
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getWeekPlan(weekStart).then(
      (plan) => !cancelled && setLoad({ status: "ready", plan }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [weekStart, reloadCount]);

  const stats = useMemo(() => (load.status === "ready" ? weekStatistics(load.plan.days) : null), [load]);

  return (
    <div className="week-stats">
      <header className="meals-header">
        <Link to={`/diet/week-plan?week=${weekStart}`} className="meals-back">
          ← Plan tygodnia
        </Link>
        <h1 className="meals-title">Statystyki tygodnia</h1>
      </header>
      <p className="week-stats-week">{weekLabel(weekStart)}</p>

      {load.status === "loading" && <p className="meals-empty">Ładowanie…</p>}

      {load.status === "error" && (
        <div className="week-status is-error" role="alert">
          <span>Nie udało się wczytać planu. {load.message}</span>
          <button type="button" className="week-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "ready" &&
        (stats ? (
          <Statistics stats={stats} />
        ) : (
          <p className="meals-empty">Brak zaplanowanych dni w tym tygodniu.</p>
        ))}
    </div>
  );
}

function Statistics({ stats }: { stats: WeekStatistics }) {
  const { averages, targetKcal } = stats;
  return (
    <>
      <p className="plans-target">
        Średnio na dzień, z {stats.days}/{DAYS_IN_WEEK} dni · normy: {NORM_PROFILE.sex}, {NORM_PROFILE.ageGroup}
      </p>

      <section className="week-stats-group">
        <h2 className="week-stats-title">Energia</h2>
        <div className="week-stats-kcal">
          <span className="meals-item-kcal">
            {number.format(Math.round(averages.kcal))}
            <span className="meals-unit"> kcal</span>
          </span>
          {targetKcal !== undefined && (
            <span className="meals-unit">
              cel {number.format(Math.round(targetKcal))} ·{" "}
              <span className={"plans-diff" + (isOffTarget(averages.kcal, targetKcal) ? " is-off" : "")}>
                {signed.format(((averages.kcal - targetKcal) / targetKcal) * 100)}%
              </span>
            </span>
          )}
        </div>
        {targetKcal !== undefined && (
          <p className="week-stats-note">Wyróżnione: poza ±{TARGET_TOLERANCE * 100}% celu wariantów.</p>
        )}
      </section>

      {NUTRIENT_GROUPS.map(({ group, label }) => (
        <section key={group} className="week-stats-group">
          <h2 className="week-stats-title">{label}</h2>
          <ul className="week-stats-list">
            {NUTRIENTS.filter((n) => n.group === group && n.key !== "kcal").map((nutrient) => (
              <NutrientRow key={nutrient.key} nutrientKey={nutrient.key} stats={stats} />
            ))}
          </ul>
        </section>
      ))}

      {Object.keys(stats.missingData).length > 0 && (
        <p className="week-stats-note">
          b.d. — tyle produktów z tego tygodnia nie ma danych dla składnika; liczone jako 0, więc średnia może być
          zaniżona.
        </p>
      )}
    </>
  );
}

function NutrientRow({ nutrientKey, stats }: { nutrientKey: NutrientKey; stats: WeekStatistics }) {
  const nutrient = NUTRIENTS.find((n) => n.key === nutrientKey)!;
  const norm = NORMS[nutrientKey];
  const pct = stats.normPercent[nutrientKey];
  const missing = stats.missingData[nutrientKey];
  const share = (ENERGY_MACROS as string[]).includes(nutrientKey) ? stats.energyShare[nutrientKey as EnergyMacro] : undefined;

  return (
    <li className="week-stats-row">
      <span className="week-stats-name">{nutrient.label}</span>
      <span className="week-stats-value">
        {number.format(stats.averages[nutrientKey])}
        <span className="meals-unit"> {nutrient.unit}</span>
      </span>
      <span className="week-stats-norm meals-unit">
        {norm && (
          <>
            norma {number.format(norm.value)} {nutrient.unit} ({norm.type})
          </>
        )}
        {share !== undefined && <>{percent.format(share)}% energii</>}
        {missing !== undefined && (
          <span className="week-stats-missing" title="brak danych">
            {" "}
            · b.d. w {missing} prod.
          </span>
        )}
      </span>
      {pct !== undefined && (
        <>
          <span className={"week-stats-pct" + (pct >= 100 ? " is-met" : "")}>{percent.format(pct)}%</span>
          <span className="week-stats-bar" aria-hidden="true">
            <span className="week-stats-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
          </span>
        </>
      )}
    </li>
  );
}
