import assert from "node:assert/strict";
import test from "node:test";
import { drawingMatchesToken, readArtToken } from "../app/api/generation-token.js";
import {
  createStoryResponse,
  storyArc,
  validateStory,
} from "../app/api/generate-story/story-generator.js";

const planningImage = "data:image/jpeg;base64,AAAA";
const artReferenceImage = "data:image/webp;base64,BBBB";

function makeValidStory(creationName = "The Blue Loop Machine", recipe = {}) {
  const creationDescriptors = [
    `${creationName} has a bright blue loop-shaped body`,
    "exactly two chunky red wheels",
    "one crooked yellow flag",
  ];
  const moral = "Big ideas work best when curiosity and kindness steer them together.";
  const scenarioTitle = recipe.scenarioTitle ?? "Doodle Island Mystery";
  const badGuyName = recipe.badGuyName ?? "";
  const interestPhrases = recipe.interestPhrases
    ?? (recipe.interestPhrase ? [recipe.interestPhrase] : []);
  const interestNarratives = recipe.interestNarratives
    ?? (recipe.interestNarrative ? [recipe.interestNarrative] : interestPhrases);

  return {
    title: `Sam and ${creationName}`,
    creationName,
    drawingSummary: "A blue loop-shaped machine with two red wheels and a yellow flag.",
    creationDescriptors,
    visualBible: `${scenarioTitle}. ${creationDescriptors.join("; ")}. Keep every feature exact. Sam has dark brown skin, springy black curls, round teal glasses, an orange-and-cream striped shirt, navy overalls, and yellow sneakers.${interestPhrases.length ? ` Story extras: ${interestPhrases.join("; ")}.` : ""}${badGuyName ? ` Villain: ${badGuyName}.` : ""}`,
    moral,
    pages: Array.from({ length: 9 }, (_, index) => ({
      beat: storyArc[index].beat,
      mood: storyArc[index].mood,
      title: `Adventure page ${index + 1}`,
      text: `Sam and ${creationName} hurried into the bright workshop as colorful lights blinked around them. A winding trail of friendly clues led past ramps, towers, and tiny doors. Sam felt a fizzy burst of excitement, took one steady breath, and studied every shape. Then they shared a clever plan, listened to friends, tested the next step carefully, and laughed when the whole invention answered with a cheerful click under the warm evening sky.${index === 0 ? ` They had arrived in ${scenarioTitle}.` : ""}${index === 1 && interestNarratives.length ? ` A clue involving ${interestNarratives.join(" and ")} unlocked the next door.` : ""}${badGuyName && index === 3 ? ` ${badGuyName} blocked the glowing path.` : ""}${index === 8 ? ` ${moral}` : ""}`,
      imageAlt: `A fresh illustration of Sam and ${creationName} on adventure page ${index + 1}.`,
      illustrationPrompt: `Use a ${storyArc[index].mood} mood. Show Sam steering ${creationName} through the page ${index + 1} action${badGuyName ? ` while ${badGuyName} watches` : ""}. Keep ${creationDescriptors.join("; ")} clearly visible.`,
      sound: index === 0 ? "ZOOM!" : "",
    })),
  };
}

function storyRequest(overrides = {}, signal) {
  return new Request("http://localhost/api/generate-story", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: planningImage,
      artReferenceDataUrl: artReferenceImage,
      scenario: "doodle-island",
      badGuy: null,
      ...overrides,
    }),
    signal,
  });
}

function storyProviderResponse(story) {
  return Response.json({
    output: [{
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(story) }],
    }],
  });
}

function fitToWordCount(text, target) {
  const words = text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? [];
  const filler = ["Sam", "and", "the", "living", "creation", "planned", "their", "next", "clever", "move"];
  while (words.length < target) words.push(...filler);
  return `${words.slice(0, target).join(" ")}.`;
}

test("validates the fixed arc, usable page lengths, label, and creation continuity", () => {
  const validStory = makeValidStory("Messi");
  const validResult = validateStory(validStory, "Messi");
  assert.equal(validResult.ok, true);
  assert.equal(validResult.errors.length, 0);
  assert.ok(validResult.totalWords > 0);

  const checks = [
    {
      expectedCode: "page-count",
      mutate: (story) => story.pages.pop(),
    },
    {
      expectedCode: "page-1-text",
      mutate: (story) => { story.pages[0].text = "Sam stopped."; },
    },
    {
      expectedCode: "page-1-completeness",
      mutate: (story) => { story.pages[0].text = `Doodle Island ${".".repeat(200)}`; },
    },
    {
      expectedCode: "page-1-beat",
      mutate: (story) => { story.pages[0].beat = "invitation"; },
    },
    {
      expectedCode: "moral-length",
      mutate: (story) => { story.moral = "Short."; },
    },
    {
      expectedCode: "label-creation-name",
      mutate: (story) => { story.creationName = "Messic"; },
    },
    {
      expectedCode: "creation-descriptors-unique",
      mutate: (story) => { story.creationDescriptors[1] = story.creationDescriptors[0]; },
    },
  ];

  for (const { expectedCode, mutate } of checks) {
    const story = structuredClone(validStory);
    mutate(story);
    const result = validateStory(story, "Messi");
    assert.equal(result.ok, false, expectedCode);
    assert.ok(result.errors.some((error) => error.code === expectedCode), expectedCode);
  }
});

test("accepts a coherent nine-page story below the old aggregate word floor", async () => {
  const story = makeValidStory();
  story.visualBible = "A warm watercolor adventure with Sam, their bright blue loop machine, two red wheels, a yellow flag, and a playful workshop world.";
  story.pages = story.pages.map((page, index) => ({
    ...page,
    text: fitToWordCount(index === 0 ? `Doodle Island ${page.text}` : page.text, 60),
    illustrationPrompt: `Show Sam and the living creation working together in a fresh landscape scene for page ${index + 1}.`,
  }));

  const validation = validateStory(story);
  assert.equal(validation.ok, true);
  assert.ok(validation.totalWords < 650);

  let providerCalls = 0;
  const response = await createStoryResponse(storyRequest({ interests: [] }), {
    apiKey: "test-key",
    fetchImpl: async () => {
      providerCalls += 1;
      return storyProviderResponse(story);
    },
  });
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 1);

  const longerStory = makeValidStory();
  longerStory.pages = longerStory.pages.map((page) => ({
    ...page,
    text: fitToWordCount(page.text, 95),
  }));
  const longerValidation = validateStory(longerStory);
  assert.equal(longerValidation.ok, true);
  assert.ok(longerValidation.totalWords > 800);
});

test("keeps complete pages just outside the prose target instead of falsely pausing", async () => {
  const story = makeValidStory();
  story.pages[0].text = fitToWordCount(`Doodle Island ${story.pages[0].text}`, 59);
  story.pages[1].text = fitToWordCount(story.pages[1].text, 100);
  story.moral = "Brave ideas can begin small. Kind plans help them grow.";

  const validation = validateStory(story);
  assert.equal(validation.ok, true);

  let providerCalls = 0;
  let prompt = "";
  const response = await createStoryResponse(storyRequest(), {
    apiKey: "test-key",
    fetchImpl: async (_input, init) => {
      providerCalls += 1;
      prompt = JSON.parse(String(init.body)).input[0].content[0].text;
      return storyProviderResponse(story);
    },
  });
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 1);
  assert.match(prompt, /Aim for 60–90 words per page/);
});

test("still rejects a genuinely incomplete page after one correction attempt", async () => {
  const incompleteStory = makeValidStory();
  incompleteStory.pages[0].text = "Doodle Island stopped.";
  let providerCalls = 0;
  const response = await createStoryResponse(storyRequest(), {
    apiKey: "test-key",
    fetchImpl: async () => {
      providerCalls += 1;
      return storyProviderResponse(incompleteStory);
    },
  });
  assert.equal(response.status, 502);
  assert.equal(providerCalls, 2);
  assert.match((await response.json()).error, /story pages? came back incomplete/i);
});

test("requests the strict story contract and steers only the selected interests", async () => {
  let providerRequest;
  const providerStory = makeValidStory("The Blue Loop Machine", {
    interestPhrases: ["badminton", "robots and clever machines"],
    interestNarratives: ["badminton", "robots"],
  });
  providerStory.pages = providerStory.pages.map((page) => {
    const strictPage = { ...page };
    delete strictPage.beat;
    delete strictPage.mood;
    return strictPage;
  });
  const response = await createStoryResponse(storyRequest({
    interests: ["badminton", "robots"],
    readingLevel: "age-7-9",
  }), {
    apiKey: "test-key",
    fetchImpl: async (_input, init) => {
      providerRequest = JSON.parse(String(init.body));
      return storyProviderResponse(providerStory);
    },
  });

  assert.equal(response.status, 200);
  const schema = providerRequest.text.format.schema;
  assert.ok(schema.required.includes("moral"));
  assert.ok(schema.required.includes("creationDescriptors"));
  assert.equal(schema.properties.creationDescriptors.minItems, 3);
  assert.equal(schema.properties.creationDescriptors.maxItems, 3);
  assert.equal(schema.properties.pages.items.required.includes("beat"), false);
  assert.equal(schema.properties.pages.items.required.includes("mood"), false);

  const prompt = providerRequest.input[0].content[0].text;
  assert.match(prompt, /Tonight's optional extras are: badminton, robots and clever machines/);
  assert.match(prompt, /Page 6 \(thrilling\)/);
  assert.match(prompt, /uploaded child-made picture is the heart of the story/i);
  assert.match(prompt, /living creation physically present and plot-important on every page/i);
  assert.match(prompt, /helps Sam win on page 8/i);
  assert.match(prompt, /Never include injury, cruelty, weapons, gore/);
  assert.match(prompt, /page 9 land naturally on the same idea/i);
  assert.match(prompt, /exactly three short, fixed, visibly checkable physical phrases/i);
  assert.match(prompt, /READING LEVEL — AGES 7–9/);
  assert.match(prompt, /varied sentence lengths/);
  assert.match(prompt, /two-step problem or connect an earlier clue/);
  assert.match(prompt, /keeping every child-safety limit/);

  const result = await response.json();
  assert.equal(result.readingLevel, "age-7-9");
  assert.deepEqual(result.pages.map((page) => page.beat), storyArc.map((page) => page.beat));
  assert.deepEqual(result.pages.map((page) => page.mood), storyArc.map((page) => page.mood));
  const token = await readArtToken(result.artToken, "test-key");
  assert.deepEqual(token.pages.map((page) => page.beat), storyArc.map((page) => page.beat));
  assert.deepEqual(token.pages.map((page) => page.mood), storyArc.map((page) => page.mood));
});

test("gives selected villains a genuinely spooky but child-safe peak", async () => {
  let providerRequest;
  const response = await createStoryResponse(storyRequest({
    scenario: "moon-base",
    badGuy: "giggle-glitch",
    interests: ["space", "mysteries"],
  }), {
    apiKey: "test-key",
    fetchImpl: async (_input, init) => {
      providerRequest = JSON.parse(String(init.body));
      return storyProviderResponse(makeValidStory("The Blue Loop Machine", {
        scenarioTitle: "Moon Base Builders",
        badGuyName: "The Giggle Glitch",
        interestPhrases: ["space travel and moon-base building", "puzzles, clues, and mysteries"],
        interestNarratives: ["space", "mystery"],
      }));
    },
  });

  assert.equal(response.status, 200);
  const prompt = providerRequest.input[0].content[0].text;
  assert.match(prompt, /Moon Base Builders/);
  assert.match(prompt, /genuinely scary villain/);
  assert.match(prompt, /Page 6 is the scary peak the selected reading level can comfortably handle/);
  assert.match(prompt, /never include injury, cruelty, weapons, gore/i);
});

test("defaults to age six and rejects invalid reading levels before spending or generation", async () => {
  let defaultPrompt = "";
  const defaultResponse = await createStoryResponse(storyRequest(), {
    apiKey: "test-key",
    fetchImpl: async (_input, init) => {
      defaultPrompt = JSON.parse(String(init.body)).input[0].content[0].text;
      return storyProviderResponse(makeValidStory());
    },
  });
  assert.equal(defaultResponse.status, 200);
  assert.equal((await defaultResponse.json()).readingLevel, "age-6");
  assert.match(defaultPrompt, /READING LEVEL — AGE 6/);
  assert.match(defaultPrompt, /clear, concrete vocabulary/);
  assert.match(defaultPrompt, /Sam, who is six/);

  for (const invalidReadingLevel of ["age-10", 7, null]) {
    let claims = 0;
    let providerCalls = 0;
    const response = await createStoryResponse(storyRequest({ readingLevel: invalidReadingLevel }), {
      apiKey: "test-key",
      claimGeneration: async () => {
        claims += 1;
        return { ok: true };
      },
      fetchImpl: async () => {
        providerCalls += 1;
        return storyProviderResponse(makeValidStory());
      },
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /valid reading level/i);
    assert.equal(claims, 0);
    assert.equal(providerCalls, 0);
  }
});

test("uses the deployment child name and appearance in story prompts", async () => {
  let providerPrompt = "";
  const response = await createStoryResponse(storyRequest(), {
    apiKey: "test-key",
    childConfig: {
      STORY_CHILD_NAME: "Avery",
      STORY_CHILD_APPEARANCE: "{name} has silver curls, amber glasses, green overalls, and purple sneakers.",
    },
    fetchImpl: async (_input, init) => {
      providerPrompt = JSON.parse(String(init.body)).input[0].content[0].text;
      return storyProviderResponse(makeValidStory());
    },
  });

  assert.equal(response.status, 200);
  assert.match(providerPrompt, /starring Avery, who is six/);
  assert.match(providerPrompt, /Avery has silver curls, amber glasses, green overalls, and purple sneakers/);
  assert.doesNotMatch(providerPrompt, /springy black curls/);
});

test("rejects a story that omits the chosen villain or invents one when disabled", async () => {
  const missingVillain = await createStoryResponse(storyRequest({
    badGuy: "giggle-glitch",
  }), {
    apiKey: "test-key",
    fetchImpl: async () => storyProviderResponse(makeValidStory()),
  });
  assert.equal(missingVillain.status, 502);

  const metadataOnlyVillainStory = makeValidStory("The Blue Loop Machine", {
    badGuyName: "The Giggle Glitch",
  });
  metadataOnlyVillainStory.pages = metadataOnlyVillainStory.pages.map((page) => ({
    ...page,
    text: page.text.replace(" The Giggle Glitch blocked the glowing path.", ""),
    illustrationPrompt: page.illustrationPrompt.replace(" while The Giggle Glitch watches", ""),
  }));
  const metadataOnlyVillain = await createStoryResponse(storyRequest({
    badGuy: "giggle-glitch",
  }), {
    apiKey: "test-key",
    fetchImpl: async () => storyProviderResponse(metadataOnlyVillainStory),
  });
  assert.equal(metadataOnlyVillain.status, 502);

  const unexpectedVillainStoryWithArticle = makeValidStory("The Blue Loop Machine", {
    badGuyName: "The Brick Snatcher",
  });
  const unexpectedVillainStory = JSON.parse(
    JSON.stringify(unexpectedVillainStoryWithArticle)
      .replaceAll("Villain: ", "")
      .replaceAll("The Brick Snatcher", "Brick Snatcher"),
  );
  const unexpectedVillain = await createStoryResponse(storyRequest({ badGuy: null }), {
    apiKey: "test-key",
    fetchImpl: async () => storyProviderResponse(unexpectedVillainStory),
  });
  assert.equal(unexpectedVillain.status, 502);
});

test("rejects a selected extra that appears only in illustrator metadata", async () => {
  const metadataOnlyInterestStory = makeValidStory("The Blue Loop Machine", {
    interestPhrase: "badminton",
  });
  metadataOnlyInterestStory.pages = metadataOnlyInterestStory.pages.map((page) => ({
    ...page,
    text: page.text.replace("A clue involving badminton", "A colorful clue"),
  }));

  const response = await createStoryResponse(storyRequest({ interests: ["badminton"] }), {
    apiKey: "test-key",
    fetchImpl: async () => storyProviderResponse(metadataOnlyInterestStory),
  });
  assert.equal(response.status, 502);
});

test("rejects a story that ignores the chosen world", async () => {
  const genericWorkshopStory = makeValidStory("The Blue Loop Machine", {
    scenarioTitle: "Bright Workshop",
  });
  const response = await createStoryResponse(storyRequest({
    scenario: "moon-base",
    interests: [],
  }), {
    apiKey: "test-key",
    fetchImpl: async () => storyProviderResponse(genericWorkshopStory),
  });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /chosen story world/i);
});

test("allows a harmless technical glitch when no villain is selected", async () => {
  const harmlessGlitchStory = makeValidStory();
  harmlessGlitchStory.pages[2].text += " A harmless technical glitch made the workshop lights blink twice, then stop.";

  const response = await createStoryResponse(storyRequest({ badGuy: null }), {
    apiKey: "test-key",
    fetchImpl: async () => storyProviderResponse(harmlessGlitchStory),
  });
  assert.equal(response.status, 200);
});

test("accepts clues as a selected mystery extra", async () => {
  const cluesOnlyStory = makeValidStory();
  const response = await createStoryResponse(storyRequest({ interests: ["mysteries"] }), {
    apiKey: "test-key",
    fetchImpl: async () => storyProviderResponse(cluesOnlyStory),
  });
  assert.equal(response.status, 200);
});

test("accepts a one-character creation name and rejects labels over 90 characters before generation", async () => {
  const oneCharacterResponse = await createStoryResponse(storyRequest({ drawingHint: "X" }), {
    apiKey: "test-key",
    fetchImpl: async () => storyProviderResponse(makeValidStory("X")),
  });
  assert.equal(oneCharacterResponse.status, 200);

  let providerCalls = 0;
  const overlongResponse = await createStoryResponse(storyRequest({ drawingHint: "X".repeat(91) }), {
    apiKey: "test-key",
    fetchImpl: async () => {
      providerCalls += 1;
      return storyProviderResponse(makeValidStory());
    },
  });
  assert.equal(overlongResponse.status, 400);
  assert.equal(providerCalls, 0);
});

test("allows zero optional extras and rejects invalid or oversized selections", async () => {
  let noExtrasPrompt = "";
  const noExtras = await createStoryResponse(storyRequest({ interests: [] }), {
    apiKey: "test-key",
    fetchImpl: async (_input, init) => {
      noExtrasPrompt = JSON.parse(String(init.body)).input[0].content[0].text;
      return storyProviderResponse(makeValidStory());
    },
  });
  assert.equal(noExtras.status, 200);
  assert.match(noExtrasPrompt, /No optional extras were selected/);
  assert.doesNotMatch(noExtrasPrompt, /Tonight's optional extras are:/);

  const legacyAllSelected = [
    "cars", "brick-builds", "block-worlds", "drawing", "badminton", "wushu",
    "space", "robots", "dinosaurs", "ocean", "mysteries", "animals",
  ];
  let legacyPrompt = "";
  const legacyResponse = await createStoryResponse(storyRequest({ interests: legacyAllSelected }), {
    apiKey: "test-key",
    fetchImpl: async (_input, init) => {
      legacyPrompt = JSON.parse(String(init.body)).input[0].content[0].text;
      return storyProviderResponse(makeValidStory());
    },
  });
  assert.equal(legacyResponse.status, 200);
  assert.match(legacyPrompt, /No optional extras were selected/);

  for (const invalidInterests of [["music"], "cars", ["cars", "cars"], ["cars", "wushu", "space"]]) {
    let providerCalls = 0;
    const response = await createStoryResponse(storyRequest({ interests: invalidInterests }), {
      apiKey: "test-key",
      fetchImpl: async () => { providerCalls += 1; },
    });
    assert.equal(response.status, 400);
    assert.equal(providerCalls, 0);
  }
});

test("accepts every expanded story-mix interest and world", async () => {
  for (const interest of ["space", "robots", "dinosaurs", "ocean", "mysteries", "animals"]) {
    const response = await createStoryResponse(storyRequest({ interests: [interest] }), { apiKey: "" });
    assert.equal(response.status, 503, interest);
  }

  for (const scenario of ["moon-base", "dinosaur-valley", "robot-workshop"]) {
    const response = await createStoryResponse(storyRequest({ scenario }), { apiKey: "" });
    assert.equal(response.status, 503, scenario);
  }
});

test("regenerates exactly once after validation failure and supplies corrections", async () => {
  const invalidStory = makeValidStory();
  invalidStory.creationDescriptors[1] = invalidStory.creationDescriptors[0];
  const prompts = [];
  let providerCalls = 0;

  const response = await createStoryResponse(storyRequest(), {
    apiKey: "test-key",
    fetchImpl: async (_input, init) => {
      providerCalls += 1;
      prompts.push(JSON.parse(String(init.body)).input[0].content[0].text);
      return storyProviderResponse(providerCalls === 1 ? invalidStory : makeValidStory());
    },
  });

  assert.equal(response.status, 200);
  assert.equal(providerCalls, 2);
  assert.doesNotMatch(prompts[0], /ONE-TIME REGENERATION CORRECTION/);
  assert.match(prompts[1], /ONE-TIME REGENERATION CORRECTION/);
  assert.match(prompts[1], /Use three different creationDescriptors/);
});

test("surfaces validation failure after one regeneration and never retries provider errors", async () => {
  const invalidStory = makeValidStory();
  invalidStory.creationDescriptors[1] = invalidStory.creationDescriptors[0];
  let validationCalls = 0;
  const invalidResponse = await createStoryResponse(storyRequest(), {
    apiKey: "test-key",
    fetchImpl: async () => {
      validationCalls += 1;
      return storyProviderResponse(invalidStory);
    },
  });
  assert.equal(invalidResponse.status, 502);
  assert.equal(validationCalls, 2);
  assert.match((await invalidResponse.json()).error, /visual details did not stay consistent/i);

  let providerErrorCalls = 0;
  const providerErrorResponse = await createStoryResponse(storyRequest(), {
    apiKey: "test-key",
    fetchImpl: async () => {
      providerErrorCalls += 1;
      return Response.json({ error: { type: "server_error" } }, { status: 500 });
    },
  });
  assert.equal(providerErrorResponse.status, 502);
  assert.equal(providerErrorCalls, 1);
});

test("uses the smaller art reference for the signed drawing digest", async () => {
  const response = await createStoryResponse(storyRequest(), {
    apiKey: "test-key",
    fetchImpl: async () => storyProviderResponse(makeValidStory()),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  const token = await readArtToken(result.artToken, "test-key");
  assert.ok(token);
  assert.equal(await drawingMatchesToken(artReferenceImage, token.drawingDigest), true);
  assert.equal(await drawingMatchesToken(planningImage, token.drawingDigest), false);
});

test("times out below the browser limit and propagates browser cancellation", async () => {
  let timedOutProviderSignal;
  const timeoutResponse = await createStoryResponse(storyRequest(), {
    apiKey: "test-key",
    storyTimeoutMs: 5,
    fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
      timedOutProviderSignal = init.signal;
      init.signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    }),
  });
  assert.equal(timeoutResponse.status, 504);
  assert.equal(timedOutProviderSignal.aborted, true);
  assert.match((await timeoutResponse.json()).error, /took too long/i);

  const requestController = new AbortController();
  let cancelledProviderSignal;
  const cancellationResponsePromise = createStoryResponse(
    storyRequest({}, requestController.signal),
    {
      apiKey: "test-key",
      fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
        cancelledProviderSignal = init.signal;
        init.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
        queueMicrotask(() => requestController.abort());
      }),
    },
  );
  const cancellationResponse = await cancellationResponsePromise;
  assert.equal(cancellationResponse.status, 499);
  assert.equal(cancelledProviderSignal.aborted, true);
  assert.match((await cancellationResponse.json()).error, /cancelled/i);
});
