/** Lower case without Polish letters, so "zolty" finds "żółty". Used by search in several modules. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** "Dieta 2800 kcal" → "dieta-2800-kcal" — for file names. */
export function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Search: every word of the query must appear in the text (both normalized). */
export function matchesWords(text: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const normalized = normalize(text);
  return words.every((word) => normalized.includes(word));
}
