const encoder = new TextEncoder();
const decoder = new TextDecoder();
const STORY_JOB_LIFETIME_MS = 10 * 60 * 1000;

export async function createArtToken({ story, drawingHint, drawingDataUrl, scenario, badGuy }, secret) {
  return createArtTokenFromDrawingDigest({
    story,
    drawingHint,
    drawingDigest: await createDrawingDigest(drawingDataUrl),
    scenario,
    badGuy,
  }, secret);
}

export async function createArtTokenFromDrawingDigest({ story, drawingHint, drawingDigest, scenario, badGuy }, secret) {
  const payload = {
    version: 1,
    expiresAt: Date.now() + (2 * 60 * 60 * 1000),
    scenario,
    badGuy,
    drawingHint,
    drawingDigest,
    storyTitle: story.title,
    creationName: story.creationName,
    drawingSummary: story.drawingSummary,
    visualBible: story.visualBible,
    moral: story.moral,
    creationDescriptors: story.creationDescriptors,
    pages: story.pages.map((page) => ({
      title: page.title,
      text: page.text,
      beat: page.beat,
      mood: page.mood,
      illustrationPrompt: page.illustrationPrompt,
    })),
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function createDrawingDigest(drawingDataUrl) {
  return digestText(drawingDataUrl);
}

export async function createStoryJobToken({
  responseId,
  attempt,
  drawingDigest,
  drawingHint,
  scenario,
  badGuy,
  interests,
  readingLevel,
  expiresAt = Date.now() + STORY_JOB_LIFETIME_MS,
}, secret) {
  const payload = {
    version: 1,
    expiresAt,
    responseId,
    attempt,
    drawingDigest,
    drawingHint,
    scenario,
    badGuy,
    interests,
    readingLevel,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signStoryJob(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function readStoryJobToken(token, secret) {
  if (typeof token !== "string" || token.length > 4_000) return null;
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) return null;
  const expected = await signStoryJob(encodedPayload, secret);
  if (!constantTimeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload)));
    if (payload?.version !== 1 || !Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) return null;
    if (typeof payload.responseId !== "string" || !/^resp_[a-z0-9_-]+$/iu.test(payload.responseId)) return null;
    if (payload.attempt !== 0 && payload.attempt !== 1) return null;
    if (typeof payload.drawingDigest !== "string" || payload.drawingDigest.length < 20) return null;
    if (typeof payload.drawingHint !== "string" || payload.drawingHint.length > 90) return null;
    if (typeof payload.scenario !== "string") return null;
    if (payload.badGuy !== null && typeof payload.badGuy !== "string") return null;
    if (!Array.isArray(payload.interests) || payload.interests.length > 2
      || !payload.interests.every((interest) => typeof interest === "string")) return null;
    if (payload.readingLevel !== "age-6" && payload.readingLevel !== "age-7-9") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readArtToken(token, secret) {
  if (typeof token !== "string" || token.length > 30_000) return null;
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) return null;
  const expected = await sign(encodedPayload, secret);
  if (!constantTimeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload)));
    if (payload?.version !== 1 || !Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) return null;
    if (!Array.isArray(payload.pages) || payload.pages.length !== 9) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function drawingMatchesToken(dataUrl, expectedDigest) {
  if (typeof expectedDigest !== "string") return false;
  return constantTimeEqual(await digestText(dataUrl), expectedDigest);
}

export async function createPageOneAnchorToken({ artToken, imageDataUrl }, secret) {
  const payload = {
    version: 1,
    expiresAt: Date.now() + (2 * 60 * 60 * 1000),
    artTokenDigest: await digestText(artToken),
    imageDigest: await digestText(imageDataUrl),
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signAnchor(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function pageOneAnchorMatchesToken({ token, artToken, imageDataUrl }, secret) {
  if (typeof token !== "string" || token.length > 2_000) return false;
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) return false;
  const expected = await signAnchor(encodedPayload, secret);
  if (!constantTimeEqual(signature, expected)) return false;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload)));
    if (payload?.version !== 1 || !Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) return false;
    if (typeof payload.artTokenDigest !== "string" || typeof payload.imageDigest !== "string") return false;
    return constantTimeEqual(payload.artTokenDigest, await digestText(artToken))
      && constantTimeEqual(payload.imageDigest, await digestText(imageDataUrl));
  } catch {
    return false;
  }
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`storygen-art-token:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function signAnchor(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`storygen-page-one-anchor:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function signStoryJob(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`storygen-story-job:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function digestText(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
