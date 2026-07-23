import {
  createDrawingDigest,
  createStoryJobToken,
} from "../generation-token.js";
import {
  buildStoryProviderRequest,
  getOpenAIUserMessage,
  parseStoryInput,
  spendingGuardResponse,
} from "./story-generator.js";

export const STORY_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const STORY_POLL_DELAY_MS = 1_200;
export const STORY_PROVIDER_REQUEST_TIMEOUT_MS = 20_000;

export async function createBackgroundStoryResponse(request, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Please send StoryGen a valid story request." }, { status: 400 });
    }

    const parsedInput = parseStoryInput(body);
    if (!parsedInput.ok) return parsedInput.response;
    const context = {
      ...parsedInput.context,
      childConfig: options.childConfig,
    };

    if (!options.apiKey) {
      return Response.json(
        { error: "Live story generation still needs its private OpenAI connection." },
        { status: 503 },
      );
    }

    if (typeof options.claimGeneration === "function") {
      let claim;
      try {
        claim = await options.claimGeneration();
      } catch (error) {
        console.error("Story generation spending guard failed", error instanceof Error ? error.message : error);
      }
      if (!claim?.ok) return spendingGuardResponse(claim);
    }

    let providerResponse;
    let responseBody;
    try {
      ({ providerResponse, responseBody } = await withStoryProviderTimeout(async (signal) => {
        const response = await fetchImpl(STORY_RESPONSES_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
            ...(context.requestId
              ? { "Idempotency-Key": `storygen-story-start-${context.requestId}` }
              : {}),
          },
          signal,
          body: JSON.stringify(buildStoryProviderRequest(context, { background: true })),
        });
        return {
          providerResponse: response,
          responseBody: await readProviderResponse(response, signal),
        };
      }, options.providerTimeoutMs));
    } catch (error) {
      console.error("OpenAI background story start failed", error instanceof Error ? error.message : error);
      return storyProviderFetchErrorResponse(error);
    }

    if (!responseBody.ok) return responseBody.response;
    if (!providerResponse.ok) {
      return providerHttpErrorResponse(providerResponse, responseBody.value?.error);
    }

    const providerStory = responseBody.value;
    if (!isTrustedResponseId(providerStory?.id)) {
      return Response.json(
        { error: "The story engine did not return a usable story pass. Please try again." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    const terminalResponse = providerTerminalResponse(providerStory);
    if (terminalResponse) return terminalResponse;

    const jobToken = await createStoryJobToken({
      responseId: providerStory.id,
      attempt: 0,
      drawingDigest: await createDrawingDigest(context.artReferenceDataUrl),
      drawingHint: context.drawingHint,
      scenario: context.scenarioId,
      badGuy: context.badGuyId,
      interests: context.selectedInterests,
      readingLevel: context.readingLevel,
    }, options.apiKey);
    return pendingStoryResponse(providerStory.status, jobToken);
  } catch (error) {
    console.error("Background story generation failed", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Something interrupted the story. Please try again." },
      { status: 500 },
    );
  }
}

export function pendingStoryResponse(providerStatus, jobToken) {
  const status = providerStatus === "queued" ? "queued" : "in_progress";
  return Response.json(
    { status, jobToken, retryAfterMs: STORY_POLL_DELAY_MS },
    {
      status: 202,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "1",
      },
    },
  );
}

export function providerTerminalResponse(responseBody) {
  switch (responseBody?.status) {
    case "queued":
    case "in_progress":
    case "completed":
      return null;
    case "failed":
      return providerTerminalErrorResponse(responseBody.error);
    case "cancelled":
      return Response.json(
        { error: "Story making was cancelled. Please start it again when you’re ready." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    case "incomplete":
      return Response.json(
        { error: "The story engine stopped before finishing all nine pages. Please try again." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    default:
      return Response.json(
        { error: "The story engine returned an unfamiliar story status. Please try again." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
  }
}

export function providerTerminalErrorResponse(error) {
  console.error("OpenAI story request failed", 502, error?.code ?? error?.type ?? "provider-error");
  return Response.json(
    { error: getOpenAIUserMessage(502, error) },
    {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function providerHttpErrorResponse(providerResponse, error) {
  const providerStatus = providerResponse.status;
  console.error("OpenAI story request failed", providerStatus, error?.code ?? error?.type ?? "provider-error");
  let status = 502;
  if (providerStatus === 429) status = 429;
  else if (providerStatus === 408 || providerStatus === 504) status = 504;
  else if (providerStatus >= 500) status = 503;

  const retryAfter = providerResponse.headers.get("retry-after");
  const headers = { "Cache-Control": "no-store" };
  if (status === 429) headers["Retry-After"] = retryAfter || "2";
  return Response.json(
    { error: getOpenAIUserMessage(providerStatus, error) },
    { status, headers },
  );
}

export function storyProviderFetchErrorResponse(error) {
  const timedOut = error?.name === "StoryProviderTimeoutError";
  return Response.json(
    {
      error: timedOut
        ? "The story engine took too long to answer this check. StoryGen can safely try again."
        : "The story engine connection was interrupted. StoryGen can safely try again.",
    },
    {
      status: timedOut ? 504 : 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "2" },
    },
  );
}

export async function readProviderResponse(providerResponse, signal) {
  try {
    return { ok: true, value: await providerResponse.json() };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (!providerResponse.ok) return { ok: true, value: {} };
    return {
      ok: false,
      response: Response.json(
        { error: "The story engine sent back an incomplete answer. Please try again." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
}

export function isTrustedResponseId(value) {
  return typeof value === "string" && /^resp_[a-z0-9_-]+$/iu.test(value);
}

export async function withStoryProviderTimeout(operation, requestedTimeoutMs) {
  const timeoutMs = Number.isFinite(requestedTimeoutMs)
    ? Math.min(STORY_PROVIDER_REQUEST_TIMEOUT_MS, Math.max(1, requestedTimeoutMs))
    : STORY_PROVIDER_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error("The OpenAI story request timed out.");
      timeoutError.name = "StoryProviderTimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
