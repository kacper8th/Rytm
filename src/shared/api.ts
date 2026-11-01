/** fetch with a Polish error message; used by every user-data module to call the API. */
export async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    // Also an expired Cloudflare Access login: the redirect to the login page cannot be followed by fetch.
    throw new Error("Brak połączenia z serwerem. Sprawdź internet albo odśwież stronę.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`Błąd serwera (${response.status})${body?.error ? `: ${body.error}` : ""}`);
  }
  return response;
}
