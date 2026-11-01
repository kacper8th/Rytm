import { Link } from "react-router";
import { getMealPlanVariants } from "./meal-plans/meal-plans";
import { getMeals } from "./meals/meals";
import { getProducts } from "./products/products";
import "./DietScreen.css";

export function DietScreen() {
  return (
    <div className="diet">
      <h1 className="diet-title">Dieta</h1>
      <ul className="diet-list">
        <li>
          <Link to="/diet/products" className="diet-item">
            <span className="diet-icon" aria-hidden="true">
              🥕
            </span>
            <span className="diet-item-label">Produkty</span>
            <span className="diet-item-count">{getProducts().length}</span>
          </Link>
        </li>
        <li>
          <Link to="/diet/meals" className="diet-item">
            <span className="diet-icon" aria-hidden="true">
              🍲
            </span>
            <span className="diet-item-label">Dania</span>
            <span className="diet-item-count">{getMeals().length}</span>
          </Link>
        </li>
        <li>
          <Link to="/diet/meal-plans" className="diet-item">
            <span className="diet-icon" aria-hidden="true">
              📅
            </span>
            <span className="diet-item-label">Jadłospisy</span>
            <span className="diet-item-count">
              {getMealPlanVariants().reduce((sum, variant) => sum + variant.plans.length, 0)}
            </span>
          </Link>
        </li>
        <li>
          <Link to="/diet/week-plan" className="diet-item">
            <span className="diet-icon" aria-hidden="true">
              🗓️
            </span>
            <span className="diet-item-label">Plan tygodnia</span>
          </Link>
        </li>
        <li>
          <Link to="/diet/shopping-lists" className="diet-item">
            <span className="diet-icon" aria-hidden="true">
              🛒
            </span>
            <span className="diet-item-label">Lista zakupów</span>
          </Link>
        </li>
        <li>
          <Link to="/diet/pantry" className="diet-item">
            <span className="diet-icon" aria-hidden="true">
              📦
            </span>
            <span className="diet-item-label">Magazyn</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
