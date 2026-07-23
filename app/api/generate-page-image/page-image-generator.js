import {
  createPageOneAnchorToken,
  drawingMatchesToken,
  pageOneAnchorMatchesToken,
  readArtToken,
} from "../generation-token.js";
import { resolveStoryChildConfig } from "../../story-child.js";

const PROVIDER_DEADLINE_MS = 130_000;
const PROVIDER_ATTEMPTS = 2;
const MAX_REFERENCE_BYTES = 2_000_000;
const MAX_IMAGE_DATA_URL_LENGTH = 6_500_000;

const badGuys = {
  "brick-snatcher": "The Brick Snatcher: a squat purple block-shaped troublemaker with three round studs on his head, thick black eyebrows, gold-rimmed blue goggles, a round nose, uneven white teeth, a ragged teal cape with red stitched patches, and a lumpy tan sack",
  "giggle-glitch": "The Giggle Glitch: a small turquoise-and-magenta pixel trickster with bright square eyes, springy zigzag limbs, a flickering checkerboard tail, and a wide electric grin",
  "gear-king": "The Gruff Gear King: a stout copper-and-red mechanical ruler with a golden gear crown, a curled silver moustache, a navy racing coat, round expressive eyes, and an oversized wind-up key",
};

const scenarios = {
  "brick-city": "Brick City Rescue",
  "block-world": "Block World Quest",
  "turbo-lab": "Turbo Car Lab",
  "sky-shuttle": "Sky Shuttle Rally",
  "dragon-temple": "Dragon Temple Trial",
  "doodle-island": "Doodle Island Mystery",
  "moon-base": "Moon Base Builders",
  "dinosaur-valley": "Dinosaur Valley Dash",
  "robot-workshop": "Robot Workshop Mystery",
};

export async function createPageImageResponse(request, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const body = await request.json();
    if (!isSupportedImage(body.drawingDataUrl)) {
      return Response.json(
        { error: "The page painter needs the uploaded creation." },
        { status: 400 },
      );
    }

    const pageNumber = Number(body.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 9) {
      return Response.json({ error: "Please choose a valid story page." }, { status: 400 });
    }

    const hasAnchorData = body.pageOneAnchorDataUrl !== undefined && body.pageOneAnchorDataUrl !== null;
    const hasAnchorToken = body.pageOneAnchorToken !== undefined && body.pageOneAnchorToken !== null;
    if (pageNumber === 1 && (hasAnchorData || hasAnchorToken)) {
      return Response.json({ error: "The first page creates the story’s consistency reference." }, { status: 400 });
    }
    if (pageNumber > 1 && (!hasAnchorData || !hasAnchorToken)) {
      return Response.json({ error: "Paint page one first so the remaining pages can stay visually consistent." }, { status: 400 });
    }
    if (hasAnchorData !== hasAnchorToken) {
      return Response.json({ error: "The page-one consistency reference is incomplete." }, { status: 400 });
    }
    if (hasAnchorData && !isSupportedImage(body.pageOneAnchorDataUrl)) {
      return Response.json({ error: "The page-one consistency reference could not be opened." }, { status: 400 });
    }

    if (!options.apiKey) {
      return Response.json(
        { error: "Live page artwork still needs its private OpenAI connection." },
        { status: 503 },
      );
    }

    const plan = await readArtToken(body.artToken, options.apiKey);
    if (!plan || !(await drawingMatchesToken(body.drawingDataUrl, plan.drawingDigest))) {
      return Response.json({ error: "This story’s private art pass expired. Make the story again." }, { status: 403 });
    }
    if (hasAnchorData && !(await pageOneAnchorMatchesToken({
      token: body.pageOneAnchorToken,
      artToken: body.artToken,
      imageDataUrl: body.pageOneAnchorDataUrl,
    }, options.apiKey))) {
      return Response.json({ error: "The page-one consistency reference does not belong to this story." }, { status: 403 });
    }

    if (typeof options.claimGeneration === "function") {
      let claim;
      try {
        claim = await options.claimGeneration({
          artToken: body.artToken,
          pageNumber,
          tokenExpiresAt: plan.expiresAt,
        });
      } catch (error) {
        console.error("Page-art spending guard failed", error instanceof Error ? error.message : error);
      }
      if (!claim?.ok) {
        if (claim?.status === 429) {
          console.warn("StoryGen page generation limit reached", {
            reason: claim.reason,
            retryAfterSeconds: claim.retryAfterSeconds,
          });
        }
        return spendingGuardResponse(claim);
      }
    }
    const scenario = scenarios[plan.scenario];
    const badGuy = plan.badGuy === null ? null : badGuys[plan.badGuy];
    if (!scenario || (plan.badGuy !== null && !badGuy)) {
      return Response.json({ error: "This story recipe could not be verified." }, { status: 400 });
    }

    if (typeof options.loadCanonicalReferences !== "function") {
      return Response.json({ error: "The page painter’s character references are unavailable." }, { status: 503 });
    }
    let references;
    try {
      references = await options.loadCanonicalReferences(plan.badGuy);
    } catch (error) {
      console.error("Canonical page-art references failed to load", error instanceof Error ? error.message : error);
      return Response.json({ error: "The page painter’s character references are unavailable." }, { status: 503 });
    }
    if (!isCanonicalReference(references?.child) || (plan.badGuy !== null && !isCanonicalReference(references?.villain))) {
      return Response.json({ error: "The page painter’s character references are unavailable." }, { status: 503 });
    }

    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("image[]", references.child, "sam-character-reference.webp");
    form.append("image[]", dataUrlToBlob(body.drawingDataUrl), "child-uploaded-creation.jpg");
    if (plan.badGuy !== null) {
      form.append("image[]", references.villain, `${plan.badGuy}-reference.webp`);
    }
    if (hasAnchorData) {
      form.append("image[]", dataUrlToBlob(body.pageOneAnchorDataUrl), "page-one-consistency-reference.webp");
    }
    form.append(
      "prompt",
      buildImagePrompt(
        plan,
        scenario,
        badGuy,
        pageNumber,
        hasAnchorData,
        resolveStoryChildConfig(options.childConfig),
      ),
    );
    form.append("size", "1536x1024");
    form.append("quality", "low");
    form.append("output_format", "webp");
    form.append("output_compression", "82");
    form.append("background", "opaque");
    form.append("moderation", "auto");
    form.append("n", "1");

    const { response: openAIResponse, body: responseBody } = await fetchOpenAIImageWithRetry({
      fetchImpl,
      form,
      apiKey: options.apiKey,
      requestSignal: request.signal,
      timeoutMs: options.providerTimeoutMs ?? PROVIDER_DEADLINE_MS,
      randomImpl: options.randomImpl ?? Math.random,
      sleepImpl: options.sleepImpl,
    });

    if (!openAIResponse.ok) {
      console.error("OpenAI page image request failed", {
        status: openAIResponse.status,
        code: responseBody.error?.code,
        type: responseBody.error?.type,
        requestId: getProviderRequestId(openAIResponse),
      });
      return Response.json(
        { error: getOpenAIUserMessage(openAIResponse.status, responseBody.error) },
        { status: openAIResponse.status === 429 ? 429 : 502 },
      );
    }

    const imageBase64 = responseBody.data?.[0]?.b64_json;
    if (typeof imageBase64 !== "string" || imageBase64.length < 100) {
      return Response.json({ error: "This page’s artwork came back incomplete. Try painting it again." }, { status: 502 });
    }

    const imageDataUrl = `data:image/webp;base64,${imageBase64}`;
    const pageOneAnchorToken = pageNumber === 1
      ? await createPageOneAnchorToken({ artToken: body.artToken, imageDataUrl }, options.apiKey)
      : undefined;
    return Response.json(
      { pageNumber, imageDataUrl, ...(pageOneAnchorToken ? { pageOneAnchorToken } : {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ProviderTimeoutError) {
      return Response.json(
        { error: "This page took too long to paint. Please try painting it again." },
        { status: 504 },
      );
    }
    console.error("Page image generation failed", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Something interrupted this page’s artwork. Please try painting it again." },
      { status: 500 },
    );
  }
}

function spendingGuardResponse(claim) {
  const status = claim?.status === 429 ? 429 : 503;
  const headers = claim?.retryAfterSeconds
    ? { "Retry-After": String(Math.max(1, Math.ceil(claim.retryAfterSeconds))) }
    : undefined;
  return Response.json(
    {
      error: claim?.error || "StoryGen paused painting to protect the family’s API credits. Please try again shortly.",
      ...(claim?.reason ? { limitReason: claim.reason } : {}),
      ...(claim?.retryAfterSeconds ? { retryAfterSeconds: claim.retryAfterSeconds } : {}),
    },
    { status, ...(headers ? { headers } : {}) },
  );
}

function buildImagePrompt(plan, scenario, badGuy, pageNumber, hasAnchorReference, storyChild) {
  const page = plan.pages[pageNumber - 1];
  const childName = storyChild.name;
  const childAppearance = storyChild.appearance;
  const creationName = cleanText(plan.creationName, 90) || `${childName}’s creation`;
  const drawingHint = cleanText(plan.drawingHint, 120);
  const drawingSummary = cleanText(plan.drawingSummary, 300);
  const visualBible = verbatimText(plan.visualBible);
  const moral = verbatimText(plan.moral);
  const creationDescriptors = Array.isArray(plan.creationDescriptors)
    ? plan.creationDescriptors.filter((value) => typeof value === "string" && value.length > 0)
    : [];
  const pageTitle = cleanText(page.title, 100);
  const pageText = verbatimText(page.text);
  const pageBeat = verbatimText(page.beat) || pageText;
  const pageMood = verbatimText(page.mood) || "Honor the emotional mood and character feelings stated in the story action.";
  const illustrationPrompt = verbatimText(page.illustrationPrompt);
  const anchorReferenceNumber = badGuy ? 4 : 3;

  return `Create one brand-new landscape children’s picture-book illustration for page ${pageNumber} of "${cleanText(plan.storyTitle, 120)}".

REFERENCE RULES
- Reference image 1 is the canonical cartoon character sheet for ${childName}. Follow it exactly.
- Reference image 2 is the child’s uploaded drawing or photographed build. It is visual inspiration, not the finished artwork. Reinterpret it as the polished story character, vehicle, invention, object, or backdrop called "${creationName}" while retaining its most recognizable child-made shapes, colors, parts, and quirks.
${badGuy ? "- Reference image 3 is the canonical villain character sheet. Preserve that villain’s face, colors, clothing, props, and proportions across every page while creating a new pose and scene." : ""}
${hasAnchorReference ? `- Reference image ${anchorReferenceNumber} is the signed page-one consistency anchor from this same story. Match its established rendering of ${childName}, "${creationName}", the villain when present, palette, materials, proportions, and storybook style, but create the new pose, action, setting, and composition required for this page.` : ""}
${drawingHint ? `- The parent’s authoritative label is "${drawingHint}". Preserve that meaning and spelling; do not guess a different word from the picture.` : "- No parent label was supplied, so follow the story’s creation name and visual bible."}
- Produce a completely fresh scene. Do not copy either reference as a flat picture, framed drawing, collage, split screen, photograph, character sheet, or page-within-a-page.

FIXED PHYSICAL DESCRIPTORS — preserve every detail below verbatim in the rendered design
- ${childAppearance}
${creationDescriptors.length > 0 ? creationDescriptors.map((descriptor) => `- ${descriptor}`).join("\n") : `- Preserve the uploaded creation exactly as specified by the visual bible and reference image 2.`}
${badGuy ? `- ${badGuy}` : "- There is no villain. Do not add a sinister character."}

VISUAL BIBLE — binding and reproduced verbatim
${visualBible}

STORY CONTINUITY
- Story world: ${scenario}.
- Uploaded creation summary: ${drawingSummary}.
${moral ? `- Overall story heart: ${moral}` : ""}

REQUIRED CAST CHECK
- ${childName} and "${creationName}" are two distinct focal characters. Do not merge them.
${badGuy ? `- Show three distinct focal characters in the same scene: (1) ${childName}, (2) "${creationName}" reinterpreted from reference image 2, and (3) the selected villain described above. The creation is not the villain. The villain must have a clearly visible face and body and cannot be replaced by a logo, gear, shadow, prop, symbol, building, or distant hidden figure.` : `- Show both ${childName} and "${creationName}" clearly in the same scene.`}

PAGE SCENE
- Page title: ${pageTitle}.
- Story action (verbatim): ${pageText}
- Narrative beat (verbatim): ${pageBeat}
- Page mood (verbatim and binding): ${pageMood}
- Illustrator’s scene plan (verbatim): ${illustrationPrompt}
- Honor the page mood exactly through facial expressions, body language, lighting, palette, weather, and composition. Do not replace it with a generic cheerful pose.
${badGuy && pageNumber === 6 ? `- This is the story’s single fear peak. Make the villain at their most spooky and imposing through dramatic shadow, scale, expression, weather, pursuit, and cinematic tension. Leave visible safe space around ${childName} and show no physical contact, weapons, realistic horror, or threatening teeth.` : badGuy && pageNumber >= 4 && pageNumber <= 5 ? `- Build spooky suspense with lengthening shadows, an ominous entrance or pursuit beginning, while keeping the intensity clearly below page 6. Leave visible safe space around ${childName} and show no physical contact, weapons, realistic horror, or threatening teeth.` : badGuy && pageNumber >= 7 ? `- Soften the villain’s posture, expression, lighting, and shadow to show ${childName} regaining control and complete safety returning.` : ""}

COMPOSITION AND STYLE
- ${childName} must be clearly visible and actively doing the page’s main action.
- "${creationName}" must be clearly visible and important to the action.
- Use a cohesive watercolor-and-colored-pencil picture-book style that matches ${childName}’s reference, with lively expressions, cinematic landscape composition, rich color, child-safe action, and an emotional palette that follows the page mood. The final pages should return to a reassuring bedtime warmth.
- Show one unified moment with a clear focal point and enough background detail to establish the story world.
- No captions, speech bubbles, labels, logos, signatures, watermarks, readable words, UI, borders, or page numbers.`;
}

function verbatimText(value) {
  return typeof value === "string" ? value : "";
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isSupportedImage(value) {
  return typeof value === "string"
    && value.length <= MAX_IMAGE_DATA_URL_LENGTH
    && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value);
}

function isCanonicalReference(value) {
  return value instanceof Blob
    && value.size >= 100
    && value.size <= MAX_REFERENCE_BYTES
    && /^(?:image\/(?:jpeg|png|webp))$/i.test(value.type);
}

function dataUrlToBlob(value) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (!match) throw new Error("Unsupported reference image");
  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

class ProviderTimeoutError extends Error {
  constructor() {
    super("OpenAI page-image request exceeded its server deadline");
    this.name = "ProviderTimeoutError";
  }
}

async function fetchOpenAIImageWithRetry({
  fetchImpl,
  form,
  apiKey,
  requestSignal,
  timeoutMs,
  randomImpl,
  sleepImpl,
}) {
  const budgetMs = Math.max(1, Math.min(PROVIDER_DEADLINE_MS, Number(timeoutMs) || PROVIDER_DEADLINE_MS));
  const deadline = Date.now() + budgetMs;

  for (let attempt = 1; attempt <= PROVIDER_ATTEMPTS; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new ProviderTimeoutError();

    const { response, body } = await fetchJsonWithDeadline(
      fetchImpl,
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      },
      remainingMs,
      requestSignal,
    );
    if (attempt === PROVIDER_ATTEMPTS || !isRetryableProviderFailure(response.status, body.error)) {
      return { response, body };
    }

    console.warn("Retrying transient OpenAI page image failure", {
      attempt,
      status: response.status,
      code: body.error?.code,
      type: body.error?.type,
      requestId: getProviderRequestId(response),
    });
    const remainingAfterResponse = deadline - Date.now();
    if (remainingAfterResponse <= 0) throw new ProviderTimeoutError();
    const jitterMs = 300 + Math.floor(Math.max(0, Math.min(1, randomImpl())) * 500);
    const delayMs = Math.min(jitterMs, Math.max(0, remainingAfterResponse - 1));
    if (delayMs > 0) {
      if (sleepImpl) await sleepImpl(delayMs);
      else await sleepWithSignal(delayMs, requestSignal);
    }
  }

  throw new Error("OpenAI page image retry loop ended unexpectedly");
}

async function fetchJsonWithDeadline(fetchImpl, url, init, timeoutMs, requestSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const onRequestAbort = () => controller.abort(requestSignal?.reason);
  if (requestSignal?.aborted) onRequestAbort();
  else requestSignal?.addEventListener("abort", onRequestAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const body = await readProviderJson(response);
    return { response, body };
  } catch (error) {
    if (timedOut) throw new ProviderTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
    requestSignal?.removeEventListener("abort", onRequestAbort);
  }
}

async function readProviderJson(response) {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof Error && /^(?:AbortError|TimeoutError)$/.test(error.name)) throw error;
    return {};
  }
}

function isRetryableProviderFailure(status, error) {
  const classification = `${error?.code ?? ""} ${error?.type ?? ""}`.toLowerCase();
  if (/image_generation_user_error|moderation|content_policy|safety|blocked|insufficient_quota|billing|hard_limit/.test(classification)) return false;
  return status === 429 || status >= 500;
}

function getProviderRequestId(response) {
  return response.headers.get("x-request-id") ?? response.headers.get("openai-request-id") ?? undefined;
}

function sleepWithSignal(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Request was cancelled"));
      return;
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason ?? new Error("Request was cancelled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function getOpenAIUserMessage(status, error) {
  const details = `${error?.code ?? ""} ${error?.type ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (status === 429 && /quota|billing|credit/.test(details)) {
    return "The OpenAI account has no API credits available. Add billing or API credits, then try again.";
  }
  if (status === 401 || status === 403) {
    return "OpenAI did not allow page artwork. Check the API key and image-model organization access.";
  }
  if (/moderation|safety|blocked/.test(details)) {
    return "StoryGen could not paint this picture safely. Try a different picture or description.";
  }
  if (status === 429) return "The page painter is busy. Please wait a moment and try again.";
  return "The page painter had trouble with this scene. Please try painting it again.";
}
