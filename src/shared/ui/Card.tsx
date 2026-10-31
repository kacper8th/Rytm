import type { ReactNode } from "react";
import "./Card.css";

type CardProps = {
  icon: string;
  title: string;
  /** Short value shown on the right side of the header, e.g. "2 / 4". */
  badge?: string;
  children?: ReactNode;
};

export function Card({ icon, title, badge, children }: CardProps) {
  return (
    <section className="card">
      <header className="card-header">
        <span className="card-icon" aria-hidden="true">
          {icon}
        </span>
        <h2 className="card-title">{title}</h2>
        {badge && <span className="card-badge">{badge}</span>}
      </header>
      {children && <div className="card-body">{children}</div>}
    </section>
  );
}
