/**
 * fetch, tried again when Directus is busy: on a 503, which it sends while it sheds load ("Under pressure"), or
 * when the request never gets an answer. It waits 2, 4, then 8 seconds, and after the last try fails as fetch would.
 */
export function fetchWithRetry(
  tries = 4,
  delay = (attempt: number) => 2000 * 2 ** attempt,
  fetcher: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      const last = attempt === tries - 1;
      let response: Response;
      try {
        response = await fetcher(input, init);
      } catch (error) {
        if (last) throw error;
        console.warn(`${describe(input)} failed (${String(error)}). Trying again.`);
        await sleep(delay(attempt));
        continue;
      }
      if (response.status !== 503 || last) return response;
      console.warn(`${describe(input)} answered 503. Trying again.`);
      await response.body?.cancel();
      await sleep(delay(attempt));
    }
  };
}

// The URL without its query, so a log never shows more than the path.
function describe(input: string | URL | Request): string {
  const url = new URL(input instanceof Request ? input.url : input);
  return url.origin + url.pathname;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
