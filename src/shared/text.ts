/** Lower case without Polish letters, so "zolty" finds "żółty". Used by search in several modules. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Search: every word of the query must appear in the text (both normalized). */
export function matchesWords(text: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const normalized = normalize(text);
  return words.every((word) => normalized.includes(word));
}
