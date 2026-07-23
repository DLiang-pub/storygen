import assert from "node:assert/strict";
import test from "node:test";
import {
  createDrawingDigest,
  createStoryJobToken,
  drawingMatchesToken,
  readArtToken,
  readStoryJobToken,
} from "../app/api/generation-token.js";
import {
  createBackgroundStoryResponse,
  STORY_PROVIDER_REQUEST_TIMEOUT_MS,
} from "../app/api/generate-story/background-story-generator.js";
import {
  cancelStoryStatusResponse,
  createStoryStatusResponse,
} from "../app/api/generate-story-status/story-status.js";
import { storyArc } from "../app/api/generate-story/story-generator.js";

const apiKey = "test-api-key";
const planningImage = "data:image/jpeg;base64,AAAA";
const artReferenceImage = "data:image/webp;base64,BBBB";

function makeValidStory() {
  const creationName = "Loop Car";
  const creationDescriptors = [
    "bright blue loop-shaped body",
    "exactly two chunky red wheels",
    "one crooked yellow flag",
  ];
  const pageText = "Sam and Loop Car rolled through Doodle Island while warm lanterns shimmered beside the winding path. Sam felt a fizzy burst of excitement, took one steady breath, and studied each bright clue. Together they tested a clever plan, helped a friendly builder repair a tiny bridge, and cheered when the blue loop engine answered with a musical click beneath the glowing evening sky.";
  return {
    title: "Sam and Loop Car",
    creationName,
    drawingSummary: "A blue loop-shaped car with two red wheels and a crooked yellow flag.",
    creationDescriptors,
    visualBible: `Warm watercolor Doodle Island scenes. Loop Car keeps its ${creationDescriptors.join(", ")}. Sam has dark brown skin, springy black curls, round teal glasses, an orange-and-cream striped shirt, navy overalls, and yellow sneakers.`,
    moral: "Steady thinking can steer even the biggest, brightest ideas.",
    pages: Array.from({ length: 9 }, (_, index) => ({
      title: `The glowing clue ${index + 1}`,
      text: `${pageText} Page ${index + 1} brings a fresh choice, and Loop Car remains beside Sam until their cozy success.`,
      imageAlt: `Sam and Loop Car following a glowing clue on page ${index + 1}.`,
      illustrationPrompt: `Show Sam and Loop Car solving the fresh page ${index + 1} action together in a wide hand-painted Doodle Island landscape.`,
      sound: index === 0 ? "VROOM!" : "",
    })),
  };
}

function providerStory(id, status, story) {
  return {
    id,
    status,
    ...(story ? {
      output: [{
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(story) }],
      }],
    } : {}),
  };
}

function initialRequest(overrides = {}) {
  return new Request("https://storygen.test/api/generate-story", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: planningImage,
      artReferenceDataUrl: artReferenceImage,
      drawingHint: "Loop Car",
      scenario: "doodle-island",
      badGuy: null,
      interests: [],
      readingLevel: "age-7-9",
      requestId: "start_1234567890_abcdefghi",
      ...overrides,
    }),
  });
}

function jobRequest(jobToken, method = "POST") {
  return new Request("https://storygen.test/api/generate-story-status", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobToken }),
  });
}

async function makeJobToken(responseId, attempt = 0, overrides = {}) {
  return createStoryJobToken({
    responseId,
    attempt,
    drawingDigest: await createDrawingDigest(artReferenceImage),
    drawingHint: "Loop Car",
    scenario: "doodle-island",
    badGuy: null,
    interests: [],
    readingLevel: "age-7-9",
    ...overrides,
  }, apiKey);
}

test("starts a background story and signs only its trusted continuation state", async () => {
  let claimCalls = 0;
  let providerUrl;
  let providerRequest;
  let providerSignal;
  let providerHeaders;
  const response = await createBackgroundStoryResponse(initialRequest(), {
    apiKey,
    claimGeneration: async () => {
      claimCalls += 1;
      return { ok: true };
    },
    fetchImpl: async (url, init) => {
      providerUrl = url;
      providerSignal = init.signal;
      providerHeaders = init.headers;
      providerRequest = JSON.parse(String(init.body));
      return Response.json(providerStory("resp_initial", "queued"));
    },
  });

  assert.equal(response.status, 202);
  assert.equal(claimCalls, 1);
  assert.equal(providerUrl, "https://api.openai.com/v1/responses");
  assert.equal(providerRequest.background, true);
  assert.equal(providerRequest.store, false);
  assert.equal(providerHeaders["Idempotency-Key"], "storygen-story-start-start_1234567890_abcdefghi");
  assert.equal(providerRequest.text.format.type, "json_schema");
  assert.equal(providerRequest.input[0].content[1].type, "input_image");
  assert.equal(providerRequest.input[0].content[1].image_url, planningImage);
  assert.equal(providerSignal instanceof AbortSignal, true);
  assert.equal(STORY_PROVIDER_REQUEST_TIMEOUT_MS, 20_000);

  const pending = await response.json();
  assert.equal(pending.status, "queued");
  assert.equal(typeof pending.retryAfterMs, "number");
  const job = await readStoryJobToken(pending.jobToken, apiKey);
  assert.equal(job.responseId, "resp_initial");
  assert.equal(job.attempt, 0);
  assert.equal(job.readingLevel, "age-7-9");
  assert.equal(await drawingMatchesToken(artReferenceImage, job.drawingDigest), true);
  assert.equal(await drawingMatchesToken(planningImage, job.drawingDigest), false);
  assert.equal(pending.jobToken.includes("AAAA"), false);
  assert.equal(pending.jobToken.includes("BBBB"), false);
});

test("polls a queued story without another spending claim and finalizes its art token", async () => {
  const jobToken = await makeJobToken("resp_poll");
  let pollRequest;
  const pendingResponse = await createStoryStatusResponse(jobRequest(jobToken), {
    apiKey,
    fetchImpl: async (url, init) => {
      pollRequest = { url, init };
      return Response.json(providerStory("resp_poll", "in_progress"));
    },
  });
  assert.equal(pendingResponse.status, 202);
  assert.equal(pollRequest.url, "https://api.openai.com/v1/responses/resp_poll");
  assert.equal(pollRequest.init.method, "GET");
  assert.equal((await pendingResponse.json()).jobToken, jobToken);

  const completedResponse = await createStoryStatusResponse(jobRequest(jobToken), {
    apiKey,
    fetchImpl: async () => Response.json(providerStory("resp_poll", "completed", makeValidStory())),
  });
  assert.equal(completedResponse.status, 200);
  const result = await completedResponse.json();
  assert.equal(result.readingLevel, "age-7-9");
  assert.deepEqual(result.pages.map((page) => page.beat), storyArc.map((page) => page.beat));
  const artToken = await readArtToken(result.artToken, apiKey);
  assert.equal(await drawingMatchesToken(artReferenceImage, artToken.drawingDigest), true);
  assert.equal(await drawingMatchesToken(planningImage, artToken.drawingDigest), false);
});

test("starts exactly one replay-safe background correction after validation failure", async () => {
  const jobToken = await makeJobToken("resp_invalid");
  const invalidStory = makeValidStory();
  invalidStory.creationDescriptors[1] = invalidStory.creationDescriptors[0];
  let retryRequest;
  let calls = 0;
  const response = await createStoryStatusResponse(jobRequest(jobToken), {
    apiKey,
    fetchImpl: async (url, init) => {
      calls += 1;
      if (calls === 1) return Response.json(providerStory("resp_invalid", "completed", invalidStory));
      retryRequest = { url, init, body: JSON.parse(String(init.body)) };
      return Response.json(providerStory("resp_retry", "queued"));
    },
  });

  assert.equal(response.status, 202);
  assert.equal(calls, 2);
  assert.equal(retryRequest.url, "https://api.openai.com/v1/responses");
  assert.equal(retryRequest.init.headers["Idempotency-Key"], "storygen-story-retry-resp_invalid");
  assert.equal(retryRequest.body.background, true);
  assert.equal(retryRequest.body.previous_response_id, "resp_invalid");
  assert.equal(retryRequest.body.input[0].content.some((item) => item.type === "input_image"), false);
  assert.match(retryRequest.body.input[0].content[0].text, /ONE-TIME REGENERATION CORRECTION/);
  assert.match(retryRequest.body.input[0].content[0].text, /Use three different creationDescriptors/);

  const pending = await response.json();
  const retryJob = await readStoryJobToken(pending.jobToken, apiKey);
  assert.equal(retryJob.responseId, "resp_retry");
  assert.equal(retryJob.attempt, 1);

  const completed = await createStoryStatusResponse(jobRequest(pending.jobToken), {
    apiKey,
    fetchImpl: async () => Response.json(providerStory("resp_retry", "completed", makeValidStory())),
  });
  assert.equal(completed.status, 200);
});

test("never starts a third pass and maps terminal, expired, and cancellation states", async () => {
  const retryToken = await makeJobToken("resp_retry_bad", 1);
  const invalidStory = makeValidStory();
  invalidStory.pages[0].text = "Doodle Island stopped.";
  let retryPollCalls = 0;
  const invalidResponse = await createStoryStatusResponse(jobRequest(retryToken), {
    apiKey,
    fetchImpl: async () => {
      retryPollCalls += 1;
      return Response.json(providerStory("resp_retry_bad", "completed", invalidStory));
    },
  });
  assert.equal(invalidResponse.status, 502);
  assert.equal(retryPollCalls, 1);
  assert.match((await invalidResponse.json()).error, /story pages? came back incomplete/i);

  const incompleteToken = await makeJobToken("resp_short");
  const incompleteResponse = await createStoryStatusResponse(jobRequest(incompleteToken), {
    apiKey,
    fetchImpl: async () => Response.json({
      ...providerStory("resp_short", "incomplete"),
      incomplete_details: { reason: "max_output_tokens" },
    }),
  });
  assert.equal(incompleteResponse.status, 502);
  assert.match((await incompleteResponse.json()).error, /ran out of room/i);

  const expiredToken = await makeJobToken("resp_expired", 0, { expiresAt: Date.now() - 1 });
  let expiredFetchCalls = 0;
  const expiredResponse = await createStoryStatusResponse(jobRequest(expiredToken), {
    apiKey,
    fetchImpl: async () => {
      expiredFetchCalls += 1;
      return Response.json({});
    },
  });
  assert.equal(expiredResponse.status, 410);
  assert.equal(expiredFetchCalls, 0);

  const cancelToken = await makeJobToken("resp_cancel");
  let cancelRequest;
  const cancelResponse = await cancelStoryStatusResponse(jobRequest(cancelToken, "DELETE"), {
    apiKey,
    fetchImpl: async (url, init) => {
      cancelRequest = { url, init };
      return Response.json(providerStory("resp_cancel", "cancelled"));
    },
  });
  assert.equal(cancelResponse.status, 200);
  assert.equal(cancelRequest.url, "https://api.openai.com/v1/responses/resp_cancel/cancel");
  assert.equal(cancelRequest.init.method, "POST");
  assert.equal(cancelRequest.init.signal instanceof AbortSignal, true);
  assert.equal((await cancelResponse.json()).status, "cancelled");
});

test("separates retryable polling failures from terminal story failures", async () => {
  const jobToken = await makeJobToken("resp_status_errors");

  const connectionResponse = await createStoryStatusResponse(jobRequest(jobToken), {
    apiKey,
    fetchImpl: async () => { throw new TypeError("socket closed"); },
  });
  assert.equal(connectionResponse.status, 503);
  assert.equal(connectionResponse.headers.get("retry-after"), "2");

  const timeoutResponse = await createStoryStatusResponse(jobRequest(jobToken), {
    apiKey,
    providerTimeoutMs: 5,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }),
  });
  assert.equal(timeoutResponse.status, 504);
  assert.equal(timeoutResponse.headers.get("retry-after"), "2");

  const busyResponse = await createStoryStatusResponse(jobRequest(jobToken), {
    apiKey,
    fetchImpl: async () => Response.json(
      { error: { type: "rate_limit_error", code: "rate_limit_exceeded" } },
      { status: 429, headers: { "Retry-After": "7" } },
    ),
  });
  assert.equal(busyResponse.status, 429);
  assert.equal(busyResponse.headers.get("retry-after"), "7");

  const refusalResponse = await createStoryStatusResponse(jobRequest(jobToken), {
    apiKey,
    fetchImpl: async () => Response.json({
      id: "resp_status_errors",
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "No." }] }],
    }),
  });
  assert.equal(refusalResponse.status, 502);
});
