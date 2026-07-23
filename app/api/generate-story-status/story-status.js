import {
  createArtTokenFromDrawingDigest,
  createStoryJobToken,
  readStoryJobToken,
} from "../generation-token.js";
import {
  buildStoryProviderRequest,
  getStoryValidationErrorResponse,
  inspectStoryProviderOutput,
  storyContextFromJob,
} from "../generate-story/story-generator.js";
import {
  isTrustedResponseId,
  pendingStoryResponse,
  providerHttpErrorResponse,
  providerTerminalErrorResponse,
  readProviderResponse,
  STORY_RESPONSES_URL,
  storyProviderFetchErrorResponse,
  withStoryProviderTimeout,
} from "../generate-story/background-story-generator.js";

export async function createStoryStatusResponse(request, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const parsedJob = await parseStoryJobRequest(request, options.apiKey, options.childConfig);
    if (!parsedJob.ok) return parsedJob.response;
    const { job, jobToken, context } = parsedJob;

    let providerResponse;
    let responseBody;
    try {
      ({ providerResponse, responseBody } = await withStoryProviderTimeout(async (signal) => {
        const response = await fetchImpl(`${STORY_RESPONSES_URL}/${encodeURIComponent(job.responseId)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${options.apiKey}` },
          signal,
        });
        return {
          providerResponse: response,
          responseBody: await readProviderResponse(response, signal),
        };
      }, options.providerTimeoutMs));
    } catch (error) {
      console.error("OpenAI story status request failed", error instanceof Error ? error.message : error);
      return storyProviderFetchErrorResponse(error);
    }

    if (!responseBody.ok) return responseBody.response;
    if (!providerResponse.ok) {
      if (providerResponse.status === 404) return expiredStoryResponse();
      return providerHttpErrorResponse(providerResponse, responseBody.value?.error);
    }

    const providerStory = responseBody.value;
    if (providerStory?.id !== job.responseId) {
      return Response.json(
        { error: "The story engine returned the wrong story pass. Please start a new story." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    switch (providerStory.status) {
      case "queued":
      case "in_progress":
        return pendingStoryResponse(providerStory.status, jobToken);
      case "completed":
        return finishCompletedStory(
          providerStory,
          job,
          context,
          options.apiKey,
          fetchImpl,
          options.providerTimeoutMs,
        );
      case "failed":
        return providerTerminalErrorResponse(providerStory.error);
      case "cancelled":
        return Response.json(
          { error: "Story making was cancelled. Please start it again when you’re ready." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      case "incomplete":
        return incompleteStoryResponse(providerStory);
      default:
        return Response.json(
          { error: "The story engine returned an unfamiliar story status. Please try again." },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
    }
  } catch (error) {
    console.error("Story status check failed", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Something interrupted the story check. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

async function finishCompletedStory(providerStory, job, context, apiKey, fetchImpl, providerTimeoutMs) {
  const inspection = inspectStoryProviderOutput(providerStory, context);
  if (inspection.kind === "refusal") {
    return Response.json(
      { error: "That picture could not be turned into a children’s story. Please try another one." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (inspection.kind === "incomplete") {
    return Response.json(
      { error: "The story came back incomplete. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (inspection.kind === "invalid") {
    console.warn(`Background story validation failed on attempt ${job.attempt + 1}`, {
      codes: inspection.validation.errors.map((error) => error.code),
      totalWords: inspection.validation.totalWords,
    });
    if (job.attempt === 0) {
      return startValidationRetry(
        job,
        context,
        inspection.validation,
        apiKey,
        fetchImpl,
        providerTimeoutMs,
      );
    }
    return getStoryValidationErrorResponse(inspection.validation, context.drawingHint);
  }

  const artToken = await createArtTokenFromDrawingDigest({
    story: inspection.story,
    drawingHint: context.drawingHint,
    drawingDigest: job.drawingDigest,
    scenario: context.scenarioId,
    badGuy: context.badGuyId,
  }, apiKey);
  return Response.json(
    { ...inspection.story, readingLevel: context.readingLevel, artToken },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function startValidationRetry(job, context, validation, apiKey, fetchImpl, providerTimeoutMs) {
  let providerResponse;
  let responseBody;
  try {
    ({ providerResponse, responseBody } = await withStoryProviderTimeout(async (signal) => {
      const response = await fetchImpl(STORY_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `storygen-story-retry-${job.responseId}`,
        },
        signal,
        body: JSON.stringify(buildStoryProviderRequest(context, {
          background: true,
          previousValidation: validation,
          previousResponseId: job.responseId,
        })),
      });
      return {
        providerResponse: response,
        responseBody: await readProviderResponse(response, signal),
      };
    }, providerTimeoutMs));
  } catch (error) {
    console.error("OpenAI story validation retry failed", error instanceof Error ? error.message : error);
    return storyProviderFetchErrorResponse(error);
  }

  if (!responseBody.ok) return responseBody.response;
  if (!providerResponse.ok) {
    return providerHttpErrorResponse(providerResponse, responseBody.value?.error);
  }

  const providerRetry = responseBody.value;
  if (!isTrustedResponseId(providerRetry?.id) || providerRetry.id === job.responseId) {
    return Response.json(
      { error: "The story engine could not start its correction pass. Please try again." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  const terminalResponse = retryTerminalResponse(providerRetry);
  if (terminalResponse) return terminalResponse;

  const retryToken = await createStoryJobToken({
    responseId: providerRetry.id,
    attempt: 1,
    drawingDigest: job.drawingDigest,
    drawingHint: context.drawingHint,
    scenario: context.scenarioId,
    badGuy: context.badGuyId,
    interests: context.selectedInterests,
    readingLevel: context.readingLevel,
  }, apiKey);
  return pendingStoryResponse(providerRetry.status, retryToken);
}

function retryTerminalResponse(responseBody) {
  switch (responseBody?.status) {
    case "queued":
    case "in_progress":
    case "completed":
      return null;
    case "failed":
      return providerTerminalErrorResponse(responseBody.error);
    case "cancelled":
      return Response.json(
        { error: "The story correction was cancelled. Please start a new story." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    case "incomplete":
      return incompleteStoryResponse(responseBody);
    default:
      return Response.json(
        { error: "The story engine returned an unfamiliar correction status. Please try again." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
  }
}

export async function cancelStoryStatusResponse(request, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const parsedJob = await parseStoryJobRequest(request, options.apiKey, options.childConfig);
    if (!parsedJob.ok) return parsedJob.response;
    const { job } = parsedJob;

    let providerResponse;
    let responseBody = {};
    try {
      ({ providerResponse, responseBody } = await withStoryProviderTimeout(async (signal) => {
        const response = await fetchImpl(
          `${STORY_RESPONSES_URL}/${encodeURIComponent(job.responseId)}/cancel`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${options.apiKey}` },
            signal,
          },
        );
        let value = {};
        try {
          value = await response.json();
        } catch (error) {
          if (signal.aborted) throw error;
        }
        return { providerResponse: response, responseBody: value };
      }, options.providerTimeoutMs));
    } catch (error) {
      console.error("OpenAI story cancellation failed", error instanceof Error ? error.message : error);
      return storyProviderFetchErrorResponse(error);
    }

    if (providerResponse.status === 404 || providerResponse.status === 409) {
      return Response.json(
        { status: "finished" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!providerResponse.ok) {
      return providerHttpErrorResponse(providerResponse, responseBody?.error);
    }

    return Response.json(
      { status: typeof responseBody?.status === "string" ? responseBody.status : "cancelled" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Story cancellation failed", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Something interrupted story cancellation. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

async function parseStoryJobRequest(request, apiKey, childConfig) {
  if (!apiKey) {
    return {
      ok: false,
      response: Response.json(
        { error: "Live story generation still needs its private OpenAI connection." },
        { status: 503 },
      ),
    };
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Please send a valid story job pass." }, { status: 400 }),
    };
  }

  const jobToken = body?.jobToken;
  const job = await readStoryJobToken(jobToken, apiKey);
  if (!job) {
    return { ok: false, response: expiredStoryResponse() };
  }
  const context = storyContextFromJob(job, childConfig);
  if (!context) {
    return {
      ok: false,
      response: Response.json(
        { error: "This story pass no longer matches StoryGen. Please start a new story." },
        { status: 410, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { ok: true, job, jobToken, context };
}

function incompleteStoryResponse(providerStory) {
  const reason = providerStory?.incomplete_details?.reason;
  const error = reason === "max_output_tokens"
    ? "The story engine ran out of room before finishing all nine pages. Please try again."
    : "The story engine stopped before finishing all nine pages. Please try again.";
  return Response.json(
    { error },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

function expiredStoryResponse() {
  return Response.json(
    { error: "This story-making pass expired. Please start a new story." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
