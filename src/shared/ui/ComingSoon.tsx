import "./ComingSoon.css";

type ComingSoonProps = {
  icon: string;
  title: string;
  text?: string;
};

/** Placeholder screen for modules that have no content yet. */
export function ComingSoon({ icon, title, text = "Ten moduł jest w przygotowaniu." }: ComingSoonProps) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-icon" aria-hidden="true">
        {icon}
      </div>
      <h1 className="coming-soon-title">{title}</h1>
      <p className="coming-soon-text">{text}</p>
    </div>
  );
}
