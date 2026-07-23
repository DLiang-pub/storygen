const encoder = new TextEncoder();

export const STORY_CLIENT_LIMIT = 8;
export const STORY_GLOBAL_LIMIT = 24;
const STORY_PAGE_COUNT = 9;
export const PAGE_CLIENT_LIMIT = STORY_CLIENT_LIMIT * STORY_PAGE_COUNT;
export const PAGE_GLOBAL_LIMIT = STORY_GLOBAL_LIMIT * STORY_PAGE_COUNT;
export const ART_TOKEN_LIMIT = 14;
export const ART_PAGE_LIMIT = 3;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const STORY_GLOBAL_KEY = "story-global";

type D1StatementLike = {
  bind: (...values: unknown[]) => D1StatementLike;
  first: <T>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type D1Like = {
  prepare: (query: string) => D1StatementLike;
};

export type GuardResult = {
  ok: boolean;
  status?: 429 | 503;
  error?: string;
  retryAfterSeconds?: number;
  reason?: "story-client" | "story-global" | "page-client" | "page-global" | "art-token" | "art-page";
};

type BucketClaim = {
  ok: true;
  retryAfterSeconds: 0;
  expiresAt: number;
} | {
  ok: false;
  retryAfterSeconds: number;
  count: number;
  expiresAt: number;
};

type ClaimedBucket = { key: string; expiresAt: number };

type AllowanceBucket = {
  limit: number;
  remaining: number;
  resetsAt: number | null;
};

export type StoryGenerationAllowanceResult = {
  ok: true;
  availableNow: boolean;
  daily: AllowanceBucket;
  hourly: AllowanceBucket;
} | {
  ok: false;
  status: 503;
  error: string;
};

export async function claimStoryGeneration({
  database,
  request,
  secret,
  now = Date.now(),
}: {
  database?: D1Like;
  request: Request;
  secret?: string;
  now?: number;
}): Promise<GuardResult> {
  if (!database || !secret) return guardUnavailable();
  try {
    const client = await clientFingerprint(request, secret);
    const clientClaim = await claimBucket(database, `story-client:${client}`, STORY_CLIENT_LIMIT, now + ONE_HOUR_MS, now);
    if (!clientClaim.ok) return rateLimited(clientClaim.retryAfterSeconds, undefined, "story-client");
    const globalClaim = await claimBucket(database, STORY_GLOBAL_KEY, STORY_GLOBAL_LIMIT, now + ONE_DAY_MS, now);
    if (!globalClaim.ok) return rateLimited(globalClaim.retryAfterSeconds, undefined, "story-global");
    await deleteExpiredBuckets(database, now);
    return { ok: true };
  } catch (error) {
    console.error("StoryGen spending guard failed", error instanceof Error ? error.message : error);
    return guardUnavailable();
  }
}

export async function getStoryGenerationAllowance({
  database,
  request,
  secret,
  now = Date.now(),
}: {
  database?: D1Like;
  request: Request;
  secret?: string;
  now?: number;
}): Promise<StoryGenerationAllowanceResult> {
  if (!database || !secret) return allowanceUnavailable();
  try {
    const client = await clientFingerprint(request, secret);
    const [daily, hourly] = await Promise.all([
      readBucket(database, STORY_GLOBAL_KEY, STORY_GLOBAL_LIMIT, now),
      readBucket(database, `story-client:${client}`, STORY_CLIENT_LIMIT, now),
    ]);
    return {
      ok: true,
      availableNow: daily.remaining > 0 && hourly.remaining > 0,
      daily,
      hourly,
    };
  } catch (error) {
    console.error("StoryGen allowance check failed", error instanceof Error ? error.message : error);
    return allowanceUnavailable();
  }
}

export async function claimPageGeneration({
  database,
  request,
  secret,
  artToken,
  pageNumber,
  tokenExpiresAt,
  now = Date.now(),
}: {
  database?: D1Like;
  request: Request;
  secret?: string;
  artToken: string;
  pageNumber: number;
  tokenExpiresAt: number;
  now?: number;
}): Promise<GuardResult> {
  if (!database || !secret) return guardUnavailable();
  const claimedBuckets: ClaimedBucket[] = [];
  try {
    const [client, tokenDigest] = await Promise.all([
      clientFingerprint(request, secret),
      sha256(artToken),
    ]);
    const tokenExpiry = Math.max(now + 1, Math.min(tokenExpiresAt, now + (2 * ONE_HOUR_MS)));
    const buckets = [
      { key: "page-global", limit: PAGE_GLOBAL_LIMIT, nextExpiry: now + ONE_DAY_MS, reason: "page-global" as const },
      { key: `page-client:${client}`, limit: PAGE_CLIENT_LIMIT, nextExpiry: now + ONE_HOUR_MS, reason: "page-client" as const },
      { key: `art-token:${tokenDigest}`, limit: ART_TOKEN_LIMIT, nextExpiry: tokenExpiry, reason: "art-token" as const },
      { key: `art-page:${tokenDigest}:${pageNumber}`, limit: ART_PAGE_LIMIT, nextExpiry: tokenExpiry, reason: "art-page" as const },
    ];
    for (const bucket of buckets) {
      const claim = await claimBucket(database, bucket.key, bucket.limit, bucket.nextExpiry, now);
      if (!claim.ok) {
        await releaseClaimedBuckets(database, claimedBuckets);
        const error = bucket.reason === "art-page"
          ? "That page has already used its painting retries. Make a new story to paint it again."
          : bucket.reason === "art-token"
            ? "This story has used its available painting retries. Make a new story to continue."
            : undefined;
        return rateLimited(claim.retryAfterSeconds, error, bucket.reason);
      }
      claimedBuckets.push({ key: bucket.key, expiresAt: claim.expiresAt });
    }
    await deleteExpiredBuckets(database, now);
    return { ok: true };
  } catch (error) {
    await releaseClaimedBuckets(database, claimedBuckets);
    console.error("StoryGen spending guard failed", error instanceof Error ? error.message : error);
    return guardUnavailable();
  }
}

async function claimBucket(database: D1Like, key: string, limit: number, nextExpiry: number, now: number): Promise<BucketClaim> {
  const row = await database.prepare(`
    INSERT INTO storygen_request_limits (key, count, expires_at)
    VALUES (?1, 1, ?2)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN storygen_request_limits.expires_at <= ?3 THEN 1 ELSE storygen_request_limits.count + 1 END,
      expires_at = CASE WHEN storygen_request_limits.expires_at <= ?3 THEN excluded.expires_at ELSE storygen_request_limits.expires_at END
    WHERE storygen_request_limits.expires_at <= ?3 OR storygen_request_limits.count < ?4
    RETURNING count, expires_at
  `).bind(key, nextExpiry, now, limit).first<{ count: number; expires_at: number }>();
  if (row) return { ok: true, retryAfterSeconds: 0, expiresAt: row.expires_at };

  const existing = await database.prepare(
    "SELECT count, expires_at FROM storygen_request_limits WHERE key = ?1",
  ).bind(key).first<{ count: number; expires_at: number }>();
  return {
    ok: false,
    count: existing?.count ?? limit,
    expiresAt: existing?.expires_at ?? nextExpiry,
    retryAfterSeconds: Math.max(1, Math.ceil(((existing?.expires_at ?? nextExpiry) - now) / 1000)),
  };
}

async function releaseClaimedBuckets(database: D1Like, claimedBuckets: ClaimedBucket[]) {
  for (const bucket of [...claimedBuckets].reverse()) {
    try {
      await database.prepare(
        "UPDATE storygen_request_limits SET count = count - 1 WHERE key = ?1 AND expires_at = ?2 AND count > 0",
      ).bind(bucket.key, bucket.expiresAt).run();
    } catch (error) {
      console.error("StoryGen spending-guard rollback failed", error instanceof Error ? error.message : error);
    }
  }
  claimedBuckets.length = 0;
}

async function readBucket(database: D1Like, key: string, limit: number, now: number): Promise<AllowanceBucket> {
  const row = await database.prepare(
    "SELECT count, expires_at FROM storygen_request_limits WHERE key = ?1",
  ).bind(key).first<{ count: number; expires_at: number }>();
  if (!row || !Number.isFinite(row.expires_at) || row.expires_at <= now) {
    return { limit, remaining: limit, resetsAt: null };
  }
  const count = Number.isFinite(row.count) ? Math.max(0, row.count) : limit;
  return {
    limit,
    remaining: Math.max(0, Math.min(limit, limit - count)),
    resetsAt: row.expires_at,
  };
}

async function deleteExpiredBuckets(database: D1Like, now: number) {
  // Opportunistic cleanup keeps one short-lived row per active anonymous
  // fingerprint or art pass and removes it after the limit window ends.
  await database.prepare(
    "DELETE FROM storygen_request_limits WHERE expires_at <= ?1",
  ).bind(now).run();
}

async function clientFingerprint(request: Request, secret: string) {
  const forwarded = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown-client";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`storygen-spending-guard:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(forwarded));
  return toBase64Url(new Uint8Array(signature));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function guardUnavailable(): GuardResult {
  return {
    ok: false,
    status: 503,
    error: "StoryGen paused generation because its API-credit safety guard is unavailable. Please try again shortly.",
  };
}

function allowanceUnavailable(): StoryGenerationAllowanceResult {
  return {
    ok: false,
    status: 503,
    error: "StoryGen could not check the family’s story allowance just now.",
  };
}

function rateLimited(
  retryAfterSeconds: number,
  error = "StoryGen is taking a short rest to protect the family’s API credits. Please try again later.",
  reason?: GuardResult["reason"],
): GuardResult {
  return { ok: false, status: 429, error, retryAfterSeconds, ...(reason ? { reason } : {}) };
}
