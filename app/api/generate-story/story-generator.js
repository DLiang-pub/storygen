import { createArtToken } from "../generation-token.js";
import { resolveStoryChildConfig } from "../../story-child.js";

const scenarios = {
  "brick-city": "Brick City Rescue — repair a giant interlocking-brick build before sunset",
  "block-world": "Block World Quest — explore, craft, and solve a cave mystery",
  "turbo-lab": "Turbo Car Lab — design a wild new car and test it",
  "sky-shuttle": "Sky Shuttle Rally — a badminton shot opens a cloud world",
  "dragon-temple": "Dragon Temple Trial — wushu focus unlocks an ancient puzzle",
  "doodle-island": "Doodle Island Mystery — every new line becomes real",
  "moon-base": "Moon Base Builders — repair a moon rover before a meteor shower",
  "dinosaur-valley": "Dinosaur Valley Dash — guide a lost hatchling through a rumbling valley",
  "robot-workshop": "Robot Workshop Mystery — wake a muddled factory and find its missing part",
};

const scenarioNarrativePatterns = {
  "brick-city": /\b(?:brick city|bricks?)\b/iu,
  "block-world": /\b(?:block world|craft|crafting|cave)\b/iu,
  "turbo-lab": /\b(?:turbo lab|cars?|vehicles?|racetrack|garage)\b/iu,
  "sky-shuttle": /\b(?:sky shuttle|badminton|shuttlecock|cloud)\b/iu,
  "dragon-temple": /\b(?:dragon temple|temple|wushu|dragon breath)\b/iu,
  "doodle-island": /\b(?:doodle island|doodle|drawing|crayon|island)\b/iu,
  "moon-base": /\b(?:moon base|moon|lunar|space|rover|meteor)\b/iu,
  "dinosaur-valley": /\b(?:dinosaur valley|dinosaurs?|fossil|prehistoric|hatchling)\b/iu,
  "robot-workshop": /\b(?:robot workshop|robots?|factory)\b/iu,
};

const badGuys = {
  "brick-snatcher": "The Brick Snatcher, a shadowy purple prowler who stalks Brick City after dark and steals the one piece holding everything together",
  "giggle-glitch": "The Giggle Glitch, an eerie flickering bug who blinks out lights and twists familiar paths into traps",
  "gear-king": "The Gruff Gear King, an intimidating mechanical ruler who chases challengers across a thunder-dark racetrack",
};

const readingLevels = {
  "age-6": `READING LEVEL — AGE 6
- Use clear, concrete vocabulary, direct cause and effect, lively dialogue, and playful repetition.
- Keep one main problem and one clear plan. Explain unfamiliar words through context.
- Make emotional cues visible and reassuring without sounding babyish.`,
  "age-7-9": `READING LEVEL — AGES 7–9
- Use richer but accessible vocabulary, varied sentence lengths, stronger sensory detail, and trust readers to infer some emotions.
- Give the mystery or villain a more layered motive or plan. Let the child solve a two-step problem or connect an earlier clue.
- Sustain suspense longer and make the consequences for the creation or world feel more meaningful, while keeping every child-safety limit and fully resolving the danger.
- Avoid babyish repetition and over-explaining.`,
};

const interests = {
  cars: "cars and imaginative vehicle design",
  "brick-builds": "advanced toy-brick builds",
  "block-worlds": "block-world crafting adventures",
  drawing: "drawing and doodling",
  badminton: "badminton",
  wushu: "wushu",
  space: "space travel and moon-base building",
  robots: "robots and clever machines",
  dinosaurs: "dinosaurs and prehistoric discoveries",
  ocean: "ocean exploration and underwater worlds",
  mysteries: "puzzles, clues, and mysteries",
  animals: "animals and creature friends",
};

const interestNarrativePatterns = {
  cars: /\b(?:car|cars|vehicle|vehicles|racetrack)\b/iu,
  "brick-builds": /\b(?:brick|bricks)\b/iu,
  "block-worlds": /\b(?:block world|craft|crafting)\b/iu,
  drawing: /\b(?:draw|drawing|doodle|crayon|pencil)\b/iu,
  badminton: /\b(?:badminton|racket|shuttlecock)\b/iu,
  wushu: /\b(?:wushu|martial arts?|dragon breath)\b/iu,
  space: /\b(?:space|moon|planet|rocket|meteor)\b/iu,
  robots: /\b(?:robot|robots)\b/iu,
  dinosaurs: /\b(?:dinosaur|dinosaurs|fossil|prehistoric)\b/iu,
  ocean: /\b(?:ocean|underwater|sea|coral|submarine)\b/iu,
  mysteries: /\b(?:mystery|puzzle|riddle|clues?)\b/iu,
  animals: /\b(?:animal|animals|creature|pet|paws?|habitat)\b/iu,
};

const interestIds = Object.keys(interests);
const MAX_SELECTED_INTERESTS = 2;

export const storyArc = [
  {
    beat: "happy",
    mood: "sunny",
    purpose: "Warm setup: the child proudly shows the child-made creation and its recognizable details.",
  },
  {
    beat: "happy",
    mood: "wonder-filled",
    purpose: "The creation comes fully to life and the child joyfully explores what it can do.",
  },
  {
    beat: "invitation",
    mood: "adventurous",
    purpose: "The living creation opens the way into the chosen world and carries the child into the adventure.",
  },
  {
    beat: "trouble-rising",
    mood: "uneasy",
    purpose: "The villain targets or blocks the creation, or an accidental obstacle threatens its mission.",
  },
  {
    beat: "trouble-rising",
    mood: "stormy",
    purpose: "The trouble grows, the stakes become real, and the child's big feelings surge.",
  },
  {
    beat: "scary-peak",
    mood: "thrilling",
    purpose: "The single most tense child-safe moment puts the creation's mission at risk while the child still has a safe choice.",
  },
  {
    beat: "childs-turn",
    mood: "determined",
    purpose: "The child steadies themself, notices a special feature of the creation, and forms the decisive plan.",
  },
  {
    beat: "turnaround",
    mood: "triumphant",
    purpose: "The child and the creation triumph together by outsmarting the villain or overcoming the obstacle.",
  },
  {
    beat: "happy-again",
    mood: "cozy",
    purpose: "Land safely and warmly, resolve everything, and state the one-sentence moral.",
  },
];

const STORY_PROVIDER_TIMEOUT_MS = 165_000;
const MIN_COMPLETE_PAGE_WORDS = 20;
const storySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "creationName", "drawingSummary", "creationDescriptors", "visualBible", "moral", "pages"],
  properties: {
    title: { type: "string", minLength: 3, maxLength: 90 },
    creationName: { type: "string", minLength: 1, maxLength: 90 },
    drawingSummary: { type: "string", minLength: 8, maxLength: 240 },
    creationDescriptors: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 3, maxLength: 100 },
    },
    visualBible: { type: "string", minLength: 80, maxLength: 900 },
    moral: { type: "string", minLength: 10, maxLength: 120 },
    pages: {
      type: "array",
      minItems: 9,
      maxItems: 9,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "text", "imageAlt", "illustrationPrompt", "sound"],
        properties: {
          title: { type: "string", minLength: 2, maxLength: 60 },
          text: { type: "string", minLength: 180, maxLength: 850 },
          imageAlt: { type: "string", minLength: 8, maxLength: 220 },
          illustrationPrompt: { type: "string", minLength: 40, maxLength: 900 },
          sound: { type: "string", maxLength: 24 },
        },
      },
    },
  },
};

export async function createStoryResponse(request, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const body = await request.json();
    const parsedInput = parseStoryInput(body);
    if (!parsedInput.ok) return parsedInput.response;
    const context = {
      ...parsedInput.context,
      childConfig: resolveStoryChildConfig(options.childConfig),
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

    const abortState = createStoryAbortState(
      request.signal,
      normalizeStoryTimeout(options.storyTimeoutMs),
    );
    let previousValidation = null;

    try {
      // The second attempt is reserved exclusively for a parsed response that
      // fails StoryGen's content contract. Provider failures are never retried.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        let openAIResponse;
        try {
          openAIResponse = await fetchImpl("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              "Content-Type": "application/json",
            },
            signal: abortState.signal,
            body: JSON.stringify(buildStoryProviderRequest(context, { previousValidation })),
          });
        } catch (error) {
          const abortResponse = getStoryAbortResponse(abortState, error);
          if (abortResponse) return abortResponse;
          throw error;
        }

        let responseBody;
        try {
          responseBody = await openAIResponse.json();
        } catch (error) {
          const abortResponse = getStoryAbortResponse(abortState, error);
          if (abortResponse) return abortResponse;
          return Response.json(
            { error: "The story engine sent back an incomplete answer. Please try again." },
            { status: 502 },
          );
        }

        if (!openAIResponse.ok) {
          console.error("OpenAI story request failed", openAIResponse.status, responseBody.error?.message);
          return Response.json(
            { error: getOpenAIUserMessage(openAIResponse.status, responseBody.error) },
            { status: openAIResponse.status === 429 ? 429 : 502 },
          );
        }

        if (findRefusal(responseBody)) {
          return Response.json(
            { error: "That picture could not be turned into a children’s story. Please try another one." },
            { status: 422 },
          );
        }

        const outputText = findOutputText(responseBody);
        if (!outputText) {
          return Response.json(
            { error: "The story came back incomplete. Please try again." },
            { status: 502 },
          );
        }

        let story;
        try {
          story = applyStoryArc(JSON.parse(outputText));
        } catch {
          return Response.json(
            { error: "The story came back incomplete. Please try again." },
            { status: 502 },
          );
        }

        const validation = validateStory(story, context.drawingHint, {
          scenarioId: context.scenarioId,
          scenario: context.scenario,
          badGuy: context.badGuy,
          selectedInterests: context.selectedInterests,
        });
        if (!validation.ok) {
          console.warn(
            `Story validation failed on attempt ${attempt + 1}`,
            {
              codes: validation.errors.map((error) => error.code),
              totalWords: validation.totalWords,
            },
          );
          if (attempt === 0) {
            previousValidation = validation;
            continue;
          }
          return getStoryValidationErrorResponse(validation, context.drawingHint);
        }

        const artToken = await createArtToken({
          story,
          drawingHint: context.drawingHint,
          drawingDataUrl: context.artReferenceDataUrl,
          scenario: context.scenarioId,
          badGuy: context.badGuyId,
        }, options.apiKey);
        return Response.json(
          { ...story, readingLevel: context.readingLevel, artToken },
          { headers: { "Cache-Control": "no-store" } },
        );
      }

      return Response.json(
        { error: "The story came back incomplete. Please try again." },
        { status: 502 },
      );
    } finally {
      abortState.cleanup();
    }
  } catch (error) {
    console.error("Story generation failed", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Something interrupted the story. Please try again." },
      { status: 500 },
    );
  }
}

export function parseStoryInput(body) {
  if (!isSupportedImage(body?.imageDataUrl)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Please add a JPG, PNG, or WebP picture before making the story." },
        { status: 400 },
      ),
    };
  }

  const artReferenceDataUrl = body.artReferenceDataUrl === undefined
    ? body.imageDataUrl
    : body.artReferenceDataUrl;
  if (!isSupportedImage(artReferenceDataUrl)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Please add a smaller JPG, PNG, or WebP art reference for the page pictures." },
        { status: 400 },
      ),
    };
  }

  const scenarioId = body.scenario;
  const scenario = scenarios[scenarioId];
  if (!scenario) {
    return {
      ok: false,
      response: Response.json({ error: "Please choose a story world." }, { status: 400 }),
    };
  }

  const badGuyId = body.badGuy ?? null;
  const badGuy = badGuyId === null ? null : badGuys[badGuyId];
  if (badGuyId !== null && !badGuy) {
    return {
      ok: false,
      response: Response.json({ error: "Please choose a valid bad guy." }, { status: 400 }),
    };
  }

  const selectedInterests = parseInterests(body.interests);
  if (!selectedInterests) {
    return {
      ok: false,
      response: Response.json(
        { error: "Please choose no more than two valid story extras." },
        { status: 400 },
      ),
    };
  }

  const drawingHint = parseDrawingHint(body.drawingHint);
  if (drawingHint === null) {
    return {
      ok: false,
      response: Response.json(
        { error: "Please keep the creation name or description to 90 characters." },
        { status: 400 },
      ),
    };
  }

  const readingLevel = parseReadingLevel(body.readingLevel);
  if (!readingLevel) {
    return {
      ok: false,
      response: Response.json(
        { error: "Please choose a valid reading level." },
        { status: 400 },
      ),
    };
  }

  const requestId = parseStoryRequestId(body.requestId);
  if (requestId === null) {
    return {
      ok: false,
      response: Response.json(
        { error: "StoryGen could not recognize this story start. Please try again." },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      scenarioId,
      scenario,
      badGuyId,
      badGuy,
      selectedInterests,
      drawingHint,
      readingLevel,
      requestId,
      planningImageDataUrl: body.imageDataUrl,
      artReferenceDataUrl,
    },
  };
}

export function storyContextFromJob(job, childConfig) {
  const scenario = scenarios[job?.scenario];
  const badGuy = job?.badGuy === null ? null : badGuys[job?.badGuy];
  const selectedInterests = parseInterests(job?.interests);
  const drawingHint = parseDrawingHint(job?.drawingHint);
  const readingLevel = parseReadingLevel(job?.readingLevel);
  if (!scenario || (job?.badGuy !== null && !badGuy) || !selectedInterests
    || drawingHint === null || !readingLevel) return null;

  return {
    scenarioId: job.scenario,
    scenario,
    badGuyId: job.badGuy,
    badGuy,
    selectedInterests,
    drawingHint,
    readingLevel,
    childConfig: resolveStoryChildConfig(childConfig),
  };
}

export function buildStoryProviderRequest(context, options = {}) {
  const content = [{
    type: "input_text",
    text: buildPrompt(
      context.scenario,
      context.badGuy ?? null,
      context.drawingHint,
      context.selectedInterests,
      context.readingLevel,
      options.previousValidation ?? null,
      resolveStoryChildConfig(context.childConfig),
    ),
  }];
  if (!options.previousResponseId) {
    content.push({ type: "input_image", image_url: context.planningImageDataUrl, detail: "high" });
  }

  return {
    model: "gpt-5.6-terra",
    store: false,
    ...(options.background ? { background: true } : {}),
    ...(options.previousResponseId ? { previous_response_id: options.previousResponseId } : {}),
    reasoning: { effort: "low" },
    max_output_tokens: 5000,
    input: [{ role: "user", content }],
    text: {
      verbosity: "medium",
      format: {
        type: "json_schema",
        name: "storygen_bedtime_story",
        strict: true,
        schema: storySchema,
      },
    },
  };
}

export function inspectStoryProviderOutput(responseBody, context) {
  if (findRefusal(responseBody)) return { kind: "refusal" };
  const outputText = findOutputText(responseBody);
  if (!outputText) return { kind: "incomplete" };

  let story;
  try {
    story = applyStoryArc(JSON.parse(outputText));
  } catch {
    return { kind: "incomplete" };
  }

  const validation = validateStory(story, context.drawingHint, {
    scenarioId: context.scenarioId,
    scenario: context.scenario,
    badGuy: context.badGuy,
    selectedInterests: context.selectedInterests,
  });
  if (!validation.ok) return { kind: "invalid", story, validation };
  return { kind: "valid", story, validation };
}

export function spendingGuardResponse(claim) {
  const status = claim?.status === 429 ? 429 : 503;
  const headers = claim?.retryAfterSeconds
    ? { "Retry-After": String(Math.max(1, Math.ceil(claim.retryAfterSeconds))) }
    : undefined;
  return Response.json(
    { error: claim?.error || "StoryGen paused generation to protect the family’s API credits. Please try again shortly." },
    { status, ...(headers ? { headers } : {}) },
  );
}

export function getOpenAIUserMessage(status, error) {
  const details = `${error?.code ?? ""} ${error?.type ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (/quota|billing|credit/.test(details)) {
    return "The OpenAI account has no API credits available. Add billing or API credits, then try again.";
  }
  if (status === 401 || status === 403) {
    return "The private OpenAI connection was rejected. Ask a grown-up to update the API key.";
  }
  if (status === 429) {
    return "The story engine is busy right now. Please wait a moment and try again.";
  }
  return "The story engine had trouble making this story. Please try again.";
}

function buildPrompt(
  scenario,
  badGuy,
  drawingHint,
  selectedInterests,
  readingLevel,
  previousValidation,
  storyChild,
) {
  const childName = storyChild.name;
  const childAppearance = storyChild.appearance;
  const arc = storyArc.map((page, index) => (
    `- Page ${index + 1} (${page.mood}): ${page.purpose}`
  )).join("\n");
  const interestList = selectedInterests.map((interest) => interests[interest]).join(", ");
  const extrasInstruction = selectedInterests.length > 0
    ? `Tonight's optional extras are: ${interestList}. Use every selected extra for one brief supporting beat that helps the creation or ${childName}; do not let an extra start a separate subplot.`
    : `No optional extras were selected. Keep the plot focused on ${childName}, the uploaded creation, the chosen world, and the villain or obstacle without adding unrelated hobby cameos.`;
  const correction = previousValidation
    ? `

ONE-TIME REGENERATION CORRECTION
The previous draft failed the server contract. Regenerate the complete story from scratch and correct every item below:
${previousValidation.errors.slice(0, 12).map((error) => `- ${error.message}`).join("\n")}`
    : "";

  return `Create a warm, adventurous nine-page bedtime story starring ${childName}, who is six. Write it for the selected listening and reading level below. The uploaded child-made picture is the heart of the story: reinterpret it as a living character, vehicle, invention, place, or mystery that causes the adventure and helps ${childName} triumph.

${readingLevels[readingLevel]}

Success means:
- First identify the picture carefully, then imaginatively reinterpret it for a polished picture-book world. Preserve its most recognizable shapes, colors, parts, and charming imperfections without treating the upload itself as finished page artwork.
- ${drawingHint ? `The parent says the picture is: "${drawingHint}". Treat this label as authoritative, preserve its spelling exactly, and never replace it with a guessed word from the picture.` : "No parent label was supplied. Use a simple, child-friendly name based on what is clearly visible, and do not invent uncertain letters or handwriting."}
- If the picture is a toy-brick car or another brick-built creation, keep its unusual construction, colors, wheels, and clever homemade features while turning it into a lively story-world creation.
- If the supplied label names a real person, keep the correct name in the story and use a warm, clearly illustrated storybook interpretation rather than claiming the child drew someone else.
- Keep the living creation physically present and plot-important on every page. It must trigger the adventure, remain central during the danger, and provide the special feature or idea that helps ${childName} win on page 8.
- Use this selected world as the backdrop: ${scenario}. The world supports the uploaded creation's adventure; it must not replace the creation as the main idea. There is no need to quote the world's title in the prose.
- ${badGuy ? `Include this optional child-safe but genuinely scary villain: ${badGuy}. The villain must have a clear goal involving the living creation, escalate the danger on pages 4–6, and be decisively outsmarted or defeated by ${childName} and the creation on page 8. Use the villain’s exact name in the story.` : `Do not include a villain, named opponent, thief, monster, bully, or other character who deliberately causes the problem. Use an accidental mishap, natural obstacle, or playful mystery that still lets ${childName} and the living creation triumph together.`}
- ${childName} must be physically present and doing something meaningful on every page. Fixed appearance: ${childAppearance}
- ${extrasInstruction}
- Give ${childName} big energy and big feelings without shaming either. Let the child use curiosity, steady breathing, planning, or kindness to steer them.
- Match the selected reading level while keeping vivid action, playful dialogue, satisfying sound words, and a reassuring ending.
- Aim for 60–90 words per page for a five-to-seven-minute read aloud. Prioritize a complete, natural page beat over hitting an exact total word count.
- When a villain is selected, pages 4–6 should be genuinely spooky and tense: use ominous entrances, pursuit, route-blocking traps, thunder, looming shadows, eerie settings, and near-misses. Page 6 is the scary peak the selected reading level can comfortably handle. ${childName} must always have a visible safe choice, escape route, or clever plan. The villain may never grab, touch, capture, imprison, kidnap, humiliate, or directly threaten ${childName} or the child’s family. Keep it thrilling. Never include injury, cruelty, weapons, gore, threats to family, or hopelessness. Pages 7–9 must fully defeat or resolve the danger and land safely. Without a villain, keep the same arc adventurous rather than frightening.
- Avoid unrequested brands or copyrighted characters, preachy moral lectures, and babyish language. A safe real-person name explicitly supplied by the parent may be retained.
- Return only the requested JSON.
- creationName is the short, correctly spelled name used throughout the story. When the parent supplied a label, creationName must repeat that label exactly.
- drawingSummary is one sentence describing what is actually visible in the upload while respecting the parent label.
- creationDescriptors must contain exactly three short, fixed, visibly checkable physical phrases for the reinterpreted creation: its defining colors, construction/part count, and one signature quirk. For example: "cobalt-blue body", "exactly four chunky red wheels", "crooked yellow lightning flag". Do not use personality traits or plot actions.
- visualBible is a compact continuity guide for an illustrator: describe the reinterpreted creation and its three fixed descriptors, ${childName}’s fixed appearance above, the chosen world, the villain when present, recurring colors, and the overall warm hand-drawn storybook style. The page-art stage also supplies the fixed descriptors, world, and villain independently.
- moral is one warm, non-preachy sentence of 10–120 characters. Let page 9 land naturally on the same idea.
- Every illustrationPrompt must describe a brand-new landscape scene for that exact page. Say what ${childName} and the living creation are doing, where the villain appears when selected, and the important setting/action. The page-art stage adds the fixed physical descriptors and emotional mood, so do not waste story space repeating them word-for-word. Do not ask to show the original upload, a photo, a frame, a collage, labels, captions, or written words.
- imageAlt describes the brand-new finished page illustration. sound may be an empty string when none fits.

FIXED NINE-PAGE ARC
${arc}${correction}`;
}

function parseDrawingHint(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= 90 ? normalized : null;
}

function parseReadingLevel(value) {
  if (value === undefined) return "age-6";
  return typeof value === "string" && Object.hasOwn(readingLevels, value) ? value : null;
}

function parseStoryRequestId(value) {
  if (value === undefined) return "";
  return typeof value === "string" && /^[a-z0-9_-]{16,100}$/iu.test(value) ? value : null;
}

function parseInterests(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every((interest) => typeof interest === "string" && Object.hasOwn(interests, interest))) {
    return null;
  }
  if (new Set(value).size !== value.length) return null;
  if (value.length > MAX_SELECTED_INTERESTS) {
    const isLegacyAllSelected = value.length === interestIds.length
      && interestIds.every((interest) => value.includes(interest));
    return isLegacyAllSelected ? [] : null;
  }
  return [...value];
}

function normalizeStoryTimeout(value) {
  if (!Number.isFinite(value) || value <= 0) return STORY_PROVIDER_TIMEOUT_MS;
  return Math.min(Math.max(1, value), STORY_PROVIDER_TIMEOUT_MS);
}

function createStoryAbortState(requestSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;
  let timeout;

  const cancelFromRequest = () => {
    cancelled = true;
    controller.abort();
  };

  if (requestSignal?.aborted) {
    cancelFromRequest();
  } else {
    requestSignal?.addEventListener("abort", cancelFromRequest, { once: true });
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    get cancelled() {
      return cancelled;
    },
    cleanup() {
      if (timeout !== undefined) clearTimeout(timeout);
      requestSignal?.removeEventListener("abort", cancelFromRequest);
    },
  };
}

function getStoryAbortResponse(abortState, error) {
  const isAbortError = error instanceof Error && error.name === "AbortError";
  if (abortState.timedOut) {
    return Response.json(
      { error: "StoryGen took too long this time. Please try again." },
      { status: 504 },
    );
  }
  if (abortState.cancelled || isAbortError) {
    return Response.json(
      { error: "Story making was cancelled. Please try again when you’re ready." },
      { status: 499 },
    );
  }
  return null;
}

export function getStoryValidationErrorResponse(validation, drawingHint) {
  if (drawingHint && validation.errors.some((error) => error.code.startsWith("label"))) {
    return Response.json(
      { error: `The story did not keep “${drawingHint}” exactly. Please try making it once more.` },
      { status: 502 },
    );
  }
  if (validation.errors.some((error) => error.code === "story-shape" || error.code === "page-count" || /-shape$/u.test(error.code))) {
    return Response.json(
      { error: "The story did not return nine complete pages this time. Please try again." },
      { status: 502 },
    );
  }
  if (validation.errors.some((error) => error.code.startsWith("recipe-villain") || error.code === "recipe-no-villain")) {
    return Response.json(
      { error: "The villain choice did not fit the adventure correctly this time. Please try again." },
      { status: 502 },
    );
  }
  if (validation.errors.some((error) => error.code.startsWith("recipe-interest"))) {
    return Response.json(
      { error: "The chosen story extras did not fit naturally this time. Please try again." },
      { status: 502 },
    );
  }
  if (validation.errors.some((error) => error.code.startsWith("recipe-scenario"))) {
    return Response.json(
      { error: "The chosen story world did not come through clearly this time. Please try again." },
      { status: 502 },
    );
  }
  if (validation.errors.some((error) => error.code.startsWith("creation-descriptor"))) {
    return Response.json(
      { error: "The creation’s visual details did not stay consistent this time. Please try again." },
      { status: 502 },
    );
  }
  return Response.json(
    { error: "One of the story pages came back incomplete. Please try again." },
    { status: 502 },
  );
}

function applyStoryArc(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.pages)) return value;
  return {
    ...value,
    pages: value.pages.map((page, index) => {
      const arc = storyArc[index];
      if (!arc || !page || typeof page !== "object" || Array.isArray(page)) return page;
      return { ...page, beat: arc.beat, mood: arc.mood };
    }),
  };
}

function storyUsesExactLabel(story, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exactLabel = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, "iu");
  const pages = Array.isArray(story?.pages) ? story.pages : [];
  const storyText = [story?.title, ...pages.flatMap((page) => [page?.title, page?.text])]
    .filter((value) => typeof value === "string")
    .join(" ");
  return exactLabel.test(storyText);
}

function isSupportedImage(value) {
  return typeof value === "string"
    && value.length <= 6_500_000
    && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value);
}

function findOutputText(response) {
  for (const output of response.output ?? []) {
    if (output.type !== "message") continue;
    for (const item of output.content ?? []) {
      if (item.type === "output_text" && item.text) return item.text;
    }
  }
  return null;
}

function findRefusal(response) {
  for (const output of response.output ?? []) {
    for (const item of output.content ?? []) {
      if (item.type === "refusal" && item.refusal) return item.refusal;
    }
  }
  return null;
}

export function validateStory(value, drawingHint = "", expectedRecipe = {}) {
  const errors = [];
  const addError = (code, message) => errors.push({ code, message });

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      totalWords: 0,
      errors: [{ code: "story-shape", message: "Return one JSON story object." }],
    };
  }

  validateString(value.title, 3, 90, "title", "title", addError);
  validateString(value.creationName, 1, 90, "creation-name", "creationName", addError);
  validateString(value.drawingSummary, 8, 240, "drawing-summary", "drawingSummary", addError);
  validateString(value.visualBible, 80, 900, "visual-bible", "visualBible", addError);
  validateString(value.moral, 10, 120, "moral-length", "moral", addError);

  const descriptors = Array.isArray(value.creationDescriptors) ? value.creationDescriptors : [];
  if (descriptors.length !== 3) {
    addError(
      "creation-descriptors-count",
      "creationDescriptors must contain exactly three fixed physical phrases.",
    );
  }
  descriptors.forEach((descriptor, index) => {
    validateString(
      descriptor,
      3,
      100,
      `creation-descriptor-${index + 1}`,
      `creationDescriptors[${index}]`,
      addError,
    );
  });
  if (descriptors.length === 3
    && descriptors.every((descriptor) => typeof descriptor === "string")
    && new Set(descriptors.map(normalizeComparable)).size !== 3) {
    addError("creation-descriptors-unique", "Use three different creationDescriptors.");
  }

  const pages = Array.isArray(value.pages) ? value.pages : [];
  if (pages.length !== storyArc.length) {
    addError("page-count", "Return exactly nine pages.");
  }

  let totalWords = 0;
  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    if (!page || typeof page !== "object" || Array.isArray(page)) {
      addError(`page-${pageNumber}-shape`, `Page ${pageNumber} must be an object.`);
      return;
    }

    validateString(page.title, 2, 60, `page-${pageNumber}-title`, `page ${pageNumber} title`, addError);
    validateString(page.text, 180, 850, `page-${pageNumber}-text`, `page ${pageNumber} text`, addError);
    validateString(page.imageAlt, 8, 220, `page-${pageNumber}-alt`, `page ${pageNumber} imageAlt`, addError);
    validateString(
      page.illustrationPrompt,
      40,
      900,
      `page-${pageNumber}-prompt`,
      `page ${pageNumber} illustrationPrompt`,
      addError,
    );
    if (typeof page.sound !== "string" || page.sound.length > 24) {
      addError(`page-${pageNumber}-sound`, `Page ${pageNumber} sound must be at most 24 characters.`);
    }

    if (typeof page.text === "string") {
      const pageWords = countWords(page.text);
      totalWords += pageWords;
      if (pageWords < MIN_COMPLETE_PAGE_WORDS) {
        addError(
          `page-${pageNumber}-completeness`,
          `Page ${pageNumber} must contain at least ${MIN_COMPLETE_PAGE_WORDS} words of story prose.`,
        );
      }
    }

    const expectedArc = storyArc[index];
    if (expectedArc && page.beat !== expectedArc.beat) {
      addError(
        `page-${pageNumber}-beat`,
        `Page ${pageNumber} beat must be "${expectedArc.beat}".`,
      );
    }
    if (expectedArc && page.mood !== expectedArc.mood) {
      addError(
        `page-${pageNumber}-mood`,
        `Page ${pageNumber} mood must be "${expectedArc.mood}".`,
      );
    }

  });

  if (drawingHint) {
    if (value.creationName !== drawingHint) {
      addError("label-creation-name", `Set creationName to the exact parent label "${drawingHint}".`);
    }
    if (!storyUsesExactLabel(value, drawingHint)) {
      addError("label-story-text", `Use the exact parent label "${drawingHint}" in the story text.`);
    }
  }

  const narrativeText = storyNarrativeText(value);
  if (expectedRecipe.scenarioId) {
    const scenarioPattern = scenarioNarrativePatterns[expectedRecipe.scenarioId];
    if (!scenarioPattern?.test(narrativeText)) {
      const scenarioTitle = typeof expectedRecipe.scenario === "string"
        ? expectedRecipe.scenario.split(" — ")[0]
        : "chosen world";
      addError("recipe-scenario-story", `Make the selected world "${scenarioTitle}" visible in the narrative action.`);
    }
  }
  if (expectedRecipe.badGuy) {
    const badGuyName = expectedRecipe.badGuy.split(",")[0];
    if (!containsNormalizedPhrase(narrativeText, badGuyName)) {
      addError("recipe-villain-story", `Use the selected villain "${badGuyName}" in the story.`);
    }
  } else if (Object.hasOwn(expectedRecipe, "badGuy")) {
    const knownBadGuyNames = Object.values(badGuys).map((description) => description.split(",")[0]);
    const knownBadGuyVariants = knownBadGuyNames.flatMap((name) => [name, name.replace(/^The\s+/iu, "")]);
    if (knownBadGuyVariants.some((name) => containsNormalizedPhrase(narrativeText, name))) {
      addError("recipe-no-villain", "Remove every villain or bad guy from this story recipe.");
    }
  }

  if (Array.isArray(expectedRecipe.selectedInterests) && expectedRecipe.selectedInterests.length > 0) {
    expectedRecipe.selectedInterests.forEach((interest) => {
      if (!interestNarrativePatterns[interest]?.test(narrativeText)) {
        addError(
          `recipe-interest-story-${interest}`,
          `Make the selected interest "${interests[interest]}" matter in the narrative action.`,
        );
      }
    });
  }

  return { ok: errors.length === 0, totalWords, errors };
}

function storyNarrativeText(value) {
  const pages = Array.isArray(value?.pages) ? value.pages : [];
  return pages.map((page) => page?.text)
    .filter((item) => typeof item === "string")
    .join(" ");
}

function validateString(value, minLength, maxLength, code, label, addError) {
  if (typeof value !== "string" || value.length < minLength || value.length > maxLength) {
    addError(code, `${label} must be ${minLength}–${maxLength} characters.`);
  }
}

function countWords(value) {
  return value.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function normalizeComparable(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function containsNormalizedPhrase(text, phrase) {
  const normalizedText = normalizeComparable(text);
  const normalizedPhrase = normalizeComparable(phrase);
  return normalizedPhrase.length > 0
    && ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}
