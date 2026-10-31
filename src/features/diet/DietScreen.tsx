import { Link } from "react-router";
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
      </ul>
    </div>
  );
}
