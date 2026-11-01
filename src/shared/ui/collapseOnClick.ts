import type { MouseEvent } from "react";

/** Elements that keep their own click — a click on them never collapses the card. */
const INTERACTIVE = "button, a, input, select, textarea, label";

/**
 * Click handler for the details of an expanded card: a click anywhere in them collapses the card.
 * Clicks on buttons, links and form fields, and selecting text, do not collapse it.
 *
 * AI note: use it only when the details are read-only or have simple buttons. Cards whose details hold
 * other expandable cards, forms, or actions that change data collapse on the header only.
 * Ask the owner when a new card does not clearly fit either case.
 */
export function collapseOnClick(close: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return;
    // a card nested in another card collapses only itself
    event.stopPropagation();
    close();
  };
}
