import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "../scripts/fetch-with-retry.ts";

const url = "https://directus.example.org/files?limit=-1";
const answer = (status: number) => new Response("{}", { status });
const noWait = () => 0;

describe("fetchWithRetry", () => {
  it("tries again after a 503 and returns the answer that works", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(answer(503)).mockResolvedValueOnce(answer(200));
    const response = await fetchWithRetry(4, noWait, fetcher)(url);
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("tries again after a network error", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(answer(200));
    expect((await fetchWithRetry(4, noWait, fetcher)(url)).status).toBe(200);
  });

  it("returns the last 503 after its last try, so the caller fails with Directus's message", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => answer(503));
    expect((await fetchWithRetry(3, noWait, fetcher)(url)).status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("throws the last network error after its last try", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchWithRetry(3, noWait, fetcher)(url)).rejects.toThrow("fetch failed");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("doesn't try again on other errors, such as a refused permission", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(answer(403));
    expect((await fetchWithRetry(4, noWait, fetcher)(url)).status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("passes each wait its attempt number, for the backoff", async () => {
    const delay = vi.fn((attempt: number) => attempt * 0);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => answer(503));
    await fetchWithRetry(4, delay, fetcher)(url);
    expect(delay.mock.calls.map(([attempt]) => attempt)).toEqual([0, 1, 2]);
  });
});
