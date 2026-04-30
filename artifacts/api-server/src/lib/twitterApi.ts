/**
 * Twitter API v2 client.
 *
 * Replaces the nitter-scrape path that the upstream maintainers shut
 * down. Three endpoints we actually need:
 *
 *   GET /2/users/by/username/:username
 *   GET /2/users/:id/tweets
 *   GET /2/users/:id/followers
 *
 * Auth via TWITTER_API_BEARER env. Without it, every call resolves to
 * { ok: false, reason: "not_configured" } so the orchestrator/intel
 * routes can degrade with a clear error instead of timing out.
 *
 * Note on the Solana CA regex: tweets come from the API as plain text;
 * we apply the same isLikelySolanaAddress check as before so wallet
 * addresses and CAs are both caught (both are base58 32-44 chars on
 * Solana).
 */

const BASE = "https://api.twitter.com/2";

export interface TwApiResponse<T> {
  ok: boolean;
  data?: T;
  reason?: "not_configured" | "rate_limited" | "not_found" | "auth_failed" | "fetch_failed";
  detail?: string;
  /** When the call hits a paginated endpoint, this is the continuation
   *  token. Pass it as `pagination_token` on the next call. Undefined
   *  on the final page. */
  nextToken?: string;
}

function bearer(): string | null {
  const t = process.env["TWITTER_API_BEARER"];
  return t && t.length > 16 ? t : null;
}

async function twFetch<T>(path: string, params: Record<string, string> = {}): Promise<TwApiResponse<T>> {
  const tok = bearer();
  if (!tok) return { ok: false, reason: "not_configured", detail: "Set TWITTER_API_BEARER to enable X scanning." };
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401) return { ok: false, reason: "auth_failed", detail: "Bearer token rejected." };
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (res.status === 429) return { ok: false, reason: "rate_limited", detail: "X API rate limit hit. Try again shortly." };
    if (!res.ok) return { ok: false, reason: "fetch_failed", detail: `HTTP ${res.status}` };
    const json = (await res.json()) as { data?: T; meta?: { next_token?: string }; errors?: Array<{ detail?: string }> };
    if (!json.data) {
      const detail = json.errors?.[0]?.detail ?? "Empty response";
      return { ok: false, reason: "not_found", detail };
    }
    return { ok: true, data: json.data, nextToken: json.meta?.next_token };
  } catch (e) {
    return { ok: false, reason: "fetch_failed", detail: e instanceof Error ? e.message : "fetch error" };
  }
}

export interface TwApiResponseWithCursor<T> extends TwApiResponse<T> {
  nextToken?: string;
}

export interface TwUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  verified?: boolean;
  created_at?: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface TwTweet {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
}

export async function getUserByUsername(username: string): Promise<TwApiResponse<TwUser>> {
  return twFetch<TwUser>(`/users/by/username/${encodeURIComponent(username)}`, {
    "user.fields": "description,verified,created_at,public_metrics,profile_image_url",
  });
}

export async function getUserTweets(userId: string, max = 100, paginationToken?: string): Promise<TwApiResponse<TwTweet[]>> {
  const params: Record<string, string> = {
    max_results: String(Math.min(100, Math.max(5, max))),
    "tweet.fields": "created_at,author_id",
    exclude: "retweets,replies",
  };
  if (paginationToken) params["pagination_token"] = paginationToken;
  return twFetch<TwTweet[]>(`/users/${encodeURIComponent(userId)}/tweets`, params);
}

/**
 * Walk pagination_token cursors until the timeline is exhausted or we
 * hit the cap. Cap defaults to 1000 tweets (10 pages of 100) which
 * comfortably covers 6+ months for most accounts and keeps API cost
 * bounded. Returns concatenated tweets + a `truncated` flag so the
 * caller can surface "showing first 1000 of N" honestly.
 */
export async function getAllUserTweets(userId: string, opts: { capPages?: number; capTweets?: number } = {}): Promise<{
  tweets: TwTweet[];
  truncated: boolean;
  pagesFetched: number;
  reason?: TwApiResponse<unknown>["reason"];
  detail?: string;
}> {
  const capPages = opts.capPages ?? 10;
  const capTweets = opts.capTweets ?? 1000;
  const tweets: TwTweet[] = [];
  let cursor: string | undefined;
  let pages = 0;
  for (let i = 0; i < capPages; i++) {
    const r = await getUserTweets(userId, 100, cursor);
    pages++;
    if (!r.ok || !r.data) {
      // Partial result is still valuable — return what we have so far.
      return { tweets, truncated: !!cursor, pagesFetched: pages, reason: r.reason, detail: r.detail };
    }
    tweets.push(...r.data);
    if (tweets.length >= capTweets) return { tweets: tweets.slice(0, capTweets), truncated: true, pagesFetched: pages };
    if (!r.nextToken) return { tweets, truncated: false, pagesFetched: pages };
    cursor = r.nextToken;
  }
  return { tweets, truncated: !!cursor, pagesFetched: pages };
}

export interface TwFollower extends TwUser {}

export async function getFollowers(userId: string, max = 100): Promise<TwApiResponse<TwFollower[]>> {
  return twFetch<TwFollower[]>(`/users/${encodeURIComponent(userId)}/followers`, {
    max_results: String(Math.min(1000, Math.max(10, max))),
    "user.fields": "description,verified,public_metrics,profile_image_url",
  });
}

export function isTwitterConfigured(): boolean {
  return bearer() !== null;
}
