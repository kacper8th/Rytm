/** Lower case without Polish letters, so "zolty" finds "żółty". Used by search in several modules. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
