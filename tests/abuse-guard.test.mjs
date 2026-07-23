import assert from "node:assert/strict";
import test from "node:test";
import {
  ART_PAGE_LIMIT,
  ART_TOKEN_LIMIT,
  claimPageGeneration,
  claimStoryGeneration,
  getStoryGenerationAllowance,
  PAGE_CLIENT_LIMIT,
  PAGE_GLOBAL_LIMIT,
  STORY_CLIENT_LIMIT,
  STORY_GLOBAL_LIMIT,
} from "../app/api/abuse-guard.ts";

class MemoryD1 {
  rows = new Map();

  prepare(query) {
    const statement = {
      values: [],
      bind: (...values) => {
        statement.values = values;
        return statement;
      },
      first: async () => {
        if (/^\s*INSERT INTO storygen_request_limits/.test(query)) {
          const [key, nextExpiry, now, limit] = statement.values;
          const existing = this.rows.get(key);
          if (existing && existing.expiresAt > now && existing.count >= limit) return null;
          const next = !existing || existing.expiresAt <= now
            ? { count: 1, expiresAt: nextExpiry }
            : { count: existing.count + 1, expiresAt: existing.expiresAt };
          this.rows.set(key, next);
          return { count: next.count, expires_at: next.expiresAt };
        }
        if (/^SELECT count, expires_at/.test(query)) {
          const existing = this.rows.get(statement.values[0]);
          return existing ? { count: existing.count, expires_at: existing.expiresAt } : null;
        }
        throw new Error(`Unexpected first query: ${query}`);
      },
      run: async () => {
        if (/^DELETE FROM storygen_request_limits/.test(query)) {
          const [now] = statement.values;
          for (const [key, row] of this.rows) if (row.expiresAt <= now) this.rows.delete(key);
          return { success: true };
        }
        if (/^UPDATE storygen_request_limits SET count = count - 1/.test(query)) {
          const [key, expiresAt] = statement.values;
          const existing = this.rows.get(key);
          if (existing && existing.expiresAt === expiresAt && existing.count > 0) {
            this.rows.set(key, { ...existing, count: existing.count - 1 });
          }
          return { success: true };
        }
        throw new Error(`Unexpected run query: ${query}`);
      },
    };
    return statement;
  }
}

function requestFrom(ip) {
  return new Request("https://storygen.test/api", { headers: { "cf-connecting-ip": ip } });
}

test("fails closed when the durable spending guard is unavailable", async () => {
  const result = await claimStoryGeneration({
    database: undefined,
    request: requestFrom("203.0.113.5"),
    secret: "test-secret",
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test("stores only an HMAC client fingerprint and enforces the story limits", async () => {
  const database = new MemoryD1();
  const now = 1_700_000_000_000;
  assert.equal(STORY_CLIENT_LIMIT, 8);
  for (let attempt = 0; attempt < STORY_CLIENT_LIMIT; attempt += 1) {
    const result = await claimStoryGeneration({
      database,
      request: requestFrom("203.0.113.5"),
      secret: "test-secret",
      now,
    });
    assert.equal(result.ok, true);
  }
  const blocked = await claimStoryGeneration({
    database,
    request: requestFrom("203.0.113.5"),
    secret: "test-secret",
    now,
  });
  assert.equal(blocked.status, 429);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal([...database.rows.keys()].some((key) => key.includes("203.0.113.5")), false);
});

test("caps anonymous story generation globally", async () => {
  const database = new MemoryD1();
  const now = 1_700_000_000_000;
  assert.equal(STORY_GLOBAL_LIMIT, 24);
  for (let attempt = 0; attempt < STORY_GLOBAL_LIMIT; attempt += 1) {
    const result = await claimStoryGeneration({
      database,
      request: requestFrom(`198.51.100.${attempt}`),
      secret: "test-secret",
      now,
    });
    assert.equal(result.ok, true);
  }
  const blocked = await claimStoryGeneration({
    database,
    request: requestFrom("192.0.2.200"),
    secret: "test-secret",
    now,
  });
  assert.equal(blocked.status, 429);
});

test("budgets at least nine page claims for every admitted story", () => {
  assert.equal(PAGE_CLIENT_LIMIT, 72);
  assert.equal(PAGE_GLOBAL_LIMIT, 216);
  assert.equal(ART_TOKEN_LIMIT, 14);
  assert.equal(ART_PAGE_LIMIT, 3);
  assert.equal(PAGE_CLIENT_LIMIT, STORY_CLIENT_LIMIT * 9);
  assert.equal(PAGE_GLOBAL_LIMIT, STORY_GLOBAL_LIMIT * 9);
});

test("reports authoritative hourly and 24-hour story allowances without writing", async () => {
  const database = new MemoryD1();
  const now = 1_700_000_000_000;
  const request = requestFrom("203.0.113.42");
  const initial = await getStoryGenerationAllowance({ database, request, secret: "test-secret", now });
  assert.deepEqual(initial, {
    ok: true,
    availableNow: true,
    daily: { limit: 24, remaining: 24, resetsAt: null },
    hourly: { limit: 8, remaining: 8, resetsAt: null },
  });
  assert.equal(database.rows.size, 0);

  assert.equal((await claimStoryGeneration({ database, request, secret: "test-secret", now })).ok, true);
  const afterOneStart = await getStoryGenerationAllowance({ database, request, secret: "test-secret", now });
  assert.deepEqual(afterOneStart, {
    ok: true,
    availableNow: true,
    daily: { limit: 24, remaining: 23, resetsAt: now + (24 * 60 * 60 * 1000) },
    hourly: { limit: 8, remaining: 7, resetsAt: now + (60 * 60 * 1000) },
  });

  const afterExpiry = await getStoryGenerationAllowance({
    database,
    request,
    secret: "test-secret",
    now: now + (24 * 60 * 60 * 1000),
  });
  assert.deepEqual(afterExpiry, {
    ok: true,
    availableNow: true,
    daily: { limit: 24, remaining: 24, resetsAt: null },
    hourly: { limit: 8, remaining: 8, resetsAt: null },
  });

  const overLimitExpiry = now + (2 * 60 * 60 * 1000);
  database.rows.set("story-global", { count: 99, expiresAt: overLimitExpiry });
  const clamped = await getStoryGenerationAllowance({ database, request, secret: "test-secret", now });
  assert.equal(clamped.ok, true);
  assert.equal(clamped.availableNow, false);
  assert.deepEqual(clamped.daily, { limit: 24, remaining: 0, resetsAt: overLimitExpiry });
});

test("fails the allowance check closed when durable counters are unavailable", async () => {
  const result = await getStoryGenerationAllowance({
    database: undefined,
    request: requestFrom("203.0.113.42"),
    secret: "test-secret",
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test("allows two page retries, then blocks replay of the same signed art pass", async () => {
  const database = new MemoryD1();
  const now = 1_700_000_000_000;
  const input = {
    database,
    request: requestFrom("203.0.113.8"),
    secret: "test-secret",
    artToken: "signed-art-token-with-story-plan",
    pageNumber: 1,
    tokenExpiresAt: now + 7_200_000,
    now,
  };
  assert.equal((await claimPageGeneration(input)).ok, true);
  assert.equal((await claimPageGeneration(input)).ok, true);
  assert.equal((await claimPageGeneration(input)).ok, true);
  const blocked = await claimPageGeneration(input);
  assert.equal(blocked.status, 429);
  assert.match(blocked.error, /painting retries/i);
  assert.equal([...database.rows.keys()].some((key) => key.includes(input.artToken)), false);
});

test("a broad page cap rejection preserves the story retry budget and succeeds after reset", async () => {
  const database = new MemoryD1();
  const now = 1_700_000_000_000;
  const globalExpiry = now + 24 * 60 * 60 * 1000;
  database.rows.set("page-global", { count: PAGE_GLOBAL_LIMIT, expiresAt: globalExpiry });
  const input = {
    database,
    request: requestFrom("203.0.113.81"),
    secret: "test-secret",
    artToken: "signed-art-token-blocked-by-global-cap",
    pageNumber: 1,
    tokenExpiresAt: now + 7_200_000,
    now,
  };

  const blocked = await claimPageGeneration(input);
  assert.equal(blocked.status, 429);
  assert.equal(database.rows.get("page-global").count, PAGE_GLOBAL_LIMIT);
  assert.equal([...database.rows.keys()].some((key) => key.startsWith("art-page:")), false);
  assert.equal([...database.rows.keys()].some((key) => key.startsWith("art-token:")), false);
  assert.equal([...database.rows.keys()].some((key) => key.startsWith("page-client:")), false);

  database.rows.set("page-global", { count: PAGE_GLOBAL_LIMIT, expiresAt: now - 1 });
  const afterReset = await claimPageGeneration(input);
  assert.equal(afterReset.ok, true);
  assert.equal(database.rows.get("page-global").count, 1);
  assert.equal([...database.rows.keys()].filter((key) => key.startsWith("art-page:")).length, 1);
  assert.equal([...database.rows.keys()].filter((key) => key.startsWith("art-token:")).length, 1);
  assert.equal([...database.rows.keys()].filter((key) => key.startsWith("page-client:")).length, 1);
});

test("rolls back an earlier global claim when the hourly page bucket rejects", async () => {
  const database = new MemoryD1();
  const now = 1_700_000_000_000;
  const request = requestFrom("203.0.113.82");
  const first = await claimPageGeneration({
    database,
    request,
    secret: "test-secret",
    artToken: "first-signed-art-token",
    pageNumber: 1,
    tokenExpiresAt: now + 7_200_000,
    now,
  });
  assert.equal(first.ok, true);
  const clientKey = [...database.rows.keys()].find((key) => key.startsWith("page-client:"));
  assert.ok(clientKey);
  database.rows.set(clientKey, { count: PAGE_CLIENT_LIMIT, expiresAt: now + 3_600_000 });
  const globalBefore = database.rows.get("page-global").count;
  const artPageKeysBefore = [...database.rows.keys()].filter((key) => key.startsWith("art-page:")).length;
  const artTokenKeysBefore = [...database.rows.keys()].filter((key) => key.startsWith("art-token:")).length;

  const blocked = await claimPageGeneration({
    database,
    request,
    secret: "test-secret",
    artToken: "second-signed-art-token",
    pageNumber: 1,
    tokenExpiresAt: now + 7_200_000,
    now,
  });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.reason, "page-client");
  assert.equal(database.rows.get("page-global").count, globalBefore);
  assert.equal([...database.rows.keys()].filter((key) => key.startsWith("art-page:")).length, artPageKeysBefore);
  assert.equal([...database.rows.keys()].filter((key) => key.startsWith("art-token:")).length, artTokenKeysBefore);
});
