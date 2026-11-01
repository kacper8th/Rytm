import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  getProducts,
  getProductWarnings,
  NUTRIENT_GROUPS,
  NUTRIENTS,
  productMatches,
  type NutrientKey,
  type Product,
} from "./products";
import { collapseOnClick } from "../../../shared/ui/collapseOnClick";
import "./ProductsScreen.css";

type SortKey = "name" | NutrientKey;
type Sort = { key: SortKey; descending: boolean };

const collator = new Intl.Collator("pl");
const number = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });

const MACROS_ON_CARD: NutrientKey[] = ["protein", "fat", "carbs"];

/** Products without data for the sorted nutrient always go last, in both directions. */
function sortProducts(products: readonly Product[], sort: Sort): Product[] {
  const direction = sort.descending ? -1 : 1;
  return [...products].sort((a, b) => {
    if (sort.key !== "name") {
      const aValue = a.nutrients[sort.key];
      const bValue = b.nutrients[sort.key];
      if (aValue === null || bValue === null) {
        if (aValue !== bValue) return aValue === null ? 1 : -1;
      } else if (aValue !== bValue) {
        return (aValue - bValue) * direction;
      }
      return collator.compare(a.name, b.name);
    }
    return collator.compare(a.name, b.name) * direction;
  });
}

/** Name ascending, nutrients descending (highest first) — the usual question is "what has the most …". */
function defaultDescending(key: SortKey): boolean {
  return key !== "name";
}

function nutrientLabel(key: NutrientKey): string {
  const nutrient = NUTRIENTS.find((n) => n.key === key)!;
  return `${nutrient.label} (${nutrient.unit})`;
}

function productSubtitle(product: Product): string {
  return product.brand ? `${product.category} · ${product.brand}` : product.category;
}

export function ProductsScreen() {
  const [sort, setSort] = useState<Sort>({ key: "name", descending: false });
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const allProducts = getProducts();
  const warnings = getProductWarnings();
  const products = useMemo(
    () => sortProducts(allProducts.filter((p) => productMatches(p, query)), sort),
    [allProducts, query, sort],
  );

  function sortBy(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, descending: !current.descending }
        : { key, descending: defaultDescending(key) },
    );
  }

  // On the phone card the sorted nutrient is shown next to the macros, unless it already is one of them.
  const extraKey =
    sort.key !== "name" && sort.key !== "kcal" && !MACROS_ON_CARD.includes(sort.key) ? sort.key : null;

  return (
    <div className="products page-wide">
      <header className="products-header">
        <Link to="/diet" className="products-back">
          ← Dieta
        </Link>
        <h1 className="products-title">Produkty</h1>
        <p className="products-count">
          {query ? `${products.length} z ${allProducts.length}` : allProducts.length} produktów · wartości na
          100 g
        </p>
      </header>

      <input
        type="search"
        className="products-search"
        placeholder="Szukaj: nazwa, firma, kategoria…"
        aria-label="Szukaj produktów"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* phone: sort controls above the list */}
      <div className="products-sort">
        <label className="products-sort-label" htmlFor="products-sort-key">
          Sortuj według
        </label>
        <select
          id="products-sort-key"
          className="products-sort-select"
          value={sort.key}
          onChange={(e) => {
            const key = e.target.value as SortKey;
            setSort({ key, descending: defaultDescending(key) });
          }}
        >
          <option value="name">Nazwa</option>
          {NUTRIENT_GROUPS.map(({ group, label }) => (
            <optgroup key={group} label={label}>
              {NUTRIENTS.filter((n) => n.group === group).map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label} ({n.unit})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          className="products-sort-direction"
          onClick={() => setSort((s) => ({ ...s, descending: !s.descending }))}
          aria-label={sort.descending ? "Malejąco" : "Rosnąco"}
        >
          {sort.descending ? "↓" : "↑"}
        </button>
      </div>

      {/* phone: list of cards */}
      <ul className="products-list">
        {products.map((product) => {
          const isOpen = openId === product.id;
          return (
            <li key={product.id} className={"products-item" + (isOpen ? " is-open" : "")}>
              <button
                type="button"
                className="products-item-summary"
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? null : product.id)}
              >
                <span className="products-item-main">
                  <span className="products-item-name">{product.name}</span>
                  <span className="products-item-sub">{productSubtitle(product)}</span>
                </span>
                <span className="products-item-kcal">
                  {number.format(product.nutrients.kcal)}
                  <span className="products-unit"> kcal</span>
                </span>
                <span className="products-item-macros">
                  {MACROS_ON_CARD.map((key) => {
                    const nutrient = NUTRIENTS.find((n) => n.key === key)!;
                    return (
                      <span key={key} className={sort.key === key ? "is-sorted" : undefined}>
                        {nutrient.short} <Amount value={product.nutrients[key]} unit="g" />
                      </span>
                    );
                  })}
                  {extraKey && (
                    <span className="is-sorted">
                      {nutrientLabel(extraKey)}: <Amount value={product.nutrients[extraKey]} />
                    </span>
                  )}
                </span>
              </button>

              {isOpen && (
                <div className="products-details" onClick={collapseOnClick(() => setOpenId(null))}>
                  {NUTRIENT_GROUPS.map(({ group, label }) => (
                    <section key={group} className="products-details-group">
                      <h2 className="products-details-title">{label}</h2>
                      <dl className="products-details-list">
                        {NUTRIENTS.filter((n) => n.group === group).map((n) => (
                          <div key={n.key} className={sort.key === n.key ? "is-sorted" : undefined}>
                            <dt>{n.label}</dt>
                            <dd>
                              <Amount value={product.nutrients[n.key]} unit={n.unit} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* PC: table with all columns, click a header to sort */}
      <div className="products-table-wrap">
        <table className="products-table">
          <thead>
            <tr className="products-table-groups">
              <th className="products-table-name" rowSpan={2}>
                <SortButton label="Produkt" active={sort.key === "name"} sort={sort} onClick={() => sortBy("name")} />
              </th>
              {NUTRIENT_GROUPS.map(({ group, label }) => (
                <th key={group} colSpan={NUTRIENTS.filter((n) => n.group === group).length} scope="colgroup">
                  {label}
                </th>
              ))}
            </tr>
            <tr>
              {NUTRIENTS.map((n) => (
                <th key={n.key} className="products-table-num" title={`${n.label} (${n.unit})`}>
                  <SortButton
                    label={n.short}
                    unit={n.unit}
                    active={sort.key === n.key}
                    sort={sort}
                    onClick={() => sortBy(n.key)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <th scope="row" className="products-table-name">
                  <span className="products-item-name">{product.name}</span>
                  <span className="products-item-sub">{productSubtitle(product)}</span>
                </th>
                {NUTRIENTS.map((n) => (
                  <td key={n.key} className={"products-table-num" + (sort.key === n.key ? " is-sorted" : "")}>
                    <Amount value={product.nutrients[n.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products.length === 0 && <p className="products-empty">Brak produktów dla „{query}”.</p>}

      {warnings.length > 0 && (
        <section className="products-warnings">
          <h2 className="products-warnings-title">⚠️ Do sprawdzenia ({warnings.length})</h2>
          <ul className="products-warnings-list">
            {warnings.map((warning) => (
              <li key={`${warning.productId}-${warning.type}`}>
                <span className="products-item-name">
                  {allProducts.find((p) => p.id === warning.productId)?.name ?? warning.productId}
                </span>
                <span className="products-item-sub">
                  Kalorie: {number.format(warning.kcal)} kcal, z makro ~{number.format(warning.estimatedKcal)} kcal
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** A nutrient value, or "b.d." (brak danych) when the product has no data for it. */
function Amount({ value, unit }: { value: number | null; unit?: string }) {
  if (value === null) {
    return (
      <span className="products-missing" title="brak danych">
        b.d.
      </span>
    );
  }
  return (
    <>
      {number.format(value)}
      {unit && ` ${unit}`}
    </>
  );
}

type SortButtonProps = {
  label: string;
  unit?: string;
  active: boolean;
  sort: Sort;
  onClick: () => void;
};

function SortButton({ label, unit, active, sort, onClick }: SortButtonProps) {
  return (
    <button type="button" className={"products-sort-button" + (active ? " is-active" : "")} onClick={onClick}>
      <span>
        {label}
        {active && <span aria-hidden="true">{sort.descending ? " ↓" : " ↑"}</span>}
      </span>
      {unit && <span className="products-unit">{unit}</span>}
    </button>
  );
}
