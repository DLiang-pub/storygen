import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createArtToken, createPageOneAnchorToken } from "../app/api/generation-token.js";
import { createPageImageResponse } from "../app/api/generate-page-image/page-image-generator.js";
import { createStoryResponse, storyArc } from "../app/api/generate-story/story-generator.js";

function makeGeneratedStory(creationName = "The Blue Loop Machine", recipe = {}) {
  const creationDescriptors = [
    `${creationName} has a bright blue loop-shaped body`,
    "exactly two chunky red wheels",
    "one crooked yellow flag",
  ];
  const moral = "Big ideas work best when curiosity and kindness steer them together.";
  const scenarioTitle = recipe.scenarioTitle ?? "Brick City Rescue";
  const badGuyName = recipe.badGuyName ?? "";
  const interestPhrase = recipe.interestPhrase ?? "cars and imaginative vehicle design";
  const interestNarrative = recipe.interestNarrative ?? interestPhrase;
  return {
    title: `Sam and ${creationName}`,
    creationName,
    drawingSummary: "A blue loop-shaped machine with two red wheels and a yellow flag.",
    visualBible: `${scenarioTitle}. ${creationDescriptors.join("; ")}. Keep every feature exact. Sam has dark brown skin, springy black curls, round teal glasses, an orange-and-cream striped shirt, navy overalls, and yellow sneakers. Story ingredient: ${interestPhrase}.${badGuyName ? ` Villain: ${badGuyName}.` : ""}`,
    moral,
    creationDescriptors,
    pages: Array.from({ length: 9 }, (_, index) => ({
      title: `Adventure page ${index + 1}`,
      text: `Sam and ${creationName} hurried into the bright workshop as colorful lights blinked around them. A winding trail of friendly clues led past ramps, towers, and tiny doors. Sam felt a fizzy burst of excitement, took one steady breath, and studied every shape. Then they shared a clever plan, listened to friends, tested the next step carefully, and laughed when the whole invention answered with a cheerful click under the warm evening sky.${index === 0 ? ` They had arrived in ${scenarioTitle}.` : ""}${index === 1 ? ` A clue involving ${interestNarrative} unlocked the next door.` : ""}${badGuyName && index === 3 ? ` ${badGuyName} blocked the glowing path.` : ""}${index === 8 ? ` ${moral}` : ""}`,
      beat: storyArc[index].beat,
      mood: storyArc[index].mood,
      imageAlt: `A fresh illustration of Sam and ${creationName} on adventure page ${index + 1}.`,
      illustrationPrompt: `Use a ${storyArc[index].mood} mood. Show Sam steering ${creationName} through the page ${index + 1} action${badGuyName ? ` while ${badGuyName} watches` : ""}. Keep ${creationDescriptors.join("; ")} clearly visible.`,
      sound: index === 0 ? "ZOOM!" : "",
    })),
  };
}

function makeCanonicalReferences(includeVillain = false) {
  return {
    child: new Blob(["C".repeat(160)], { type: "image/webp" }),
    villain: includeVillain ? new Blob(["V".repeat(160)], { type: "image/webp" }) : undefined,
  };
}

test("renders the desk-at-night studio around the picture upload", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, />StoryGen</);
  assert.doesNotMatch(page, />StoryGen 2</);
  assert.match(page, /<h1 id="upload-title">What did your child make tonight\?<\/h1>/);
  assert.match(page, /<strong>Snap their drawing or build\.<\/strong>/);
  assert.doesNotMatch(page, /One creation\. A whole new adventure\./);
  assert.doesNotMatch(page, /Made from one child’s imagination/);
  assert.doesNotMatch(page, /hero-stat|stat-row|studio-hero/);
  assert.match(page, /type="file"/);
  assert.match(page, /accept="image\/\*"/);
  assert.match(page, /What is it\?/);
  assert.match(page, /footballer/);
  assert.match(page, /id="drawing-hint" value=\{drawingHint\} maxLength=\{90\}/);
  assert.match(page, /const nightlyCtaCopy = !drawingUrl/);
  assert.match(page, /className="story-start-dock" id="studio-create"/);
  assert.match(page, /Moon Base Builders/);
  assert.match(page, /Dinosaur Valley Dash/);
  assert.match(page, /Robot Workshop Mystery/);
  assert.match(page, /Space/);
  assert.match(page, /Robots/);
  assert.match(page, /Dinosaurs/);
  assert.match(page, /Ocean/);
  assert.match(page, /Mysteries/);
  assert.match(page, /Animals/);
  assert.match(page, /const MAX_STORY_EXTRAS = 2;/);
  assert.match(page, /useState<string\[\]>\(\[\]\)/);
  assert.match(page, /Add up to two\. The uploaded creation still leads the story\./);
  assert.match(page, /disabled=\{disabled\}/);
  assert.match(page, /storedInterests\.length <= MAX_STORY_EXTRAS/);
  assert.match(page, /setStoryInterests\(savedExtras\)/);
  assert.doesNotMatch(page, /setSelectedInterests\(savedExtras\)/);
  assert.match(page, /The child and their creation triumph in the end/);
  assert.match(page, /type ReadingLevel = "age-6" \| "age-7-9"/);
  assert.match(page, /useState<ReadingLevel>\("age-6"\)/);
  assert.match(page, /<legend>Reading level<\/legend>/);
  assert.match(page, /The main character stays six\. The language and detail can grow\./);
  assert.match(page, /Clear sentences and playful repetition/);
  assert.match(page, /Richer words and more detail/);
  assert.match(page, /type="radio" name="reading-level"/);
  assert.match(page, /readingLevel: result\.readingLevel/);
  assert.match(page, /story\.readingLevel === "age-7-9"/);
  assert.match(page, /Save story/);
  assert.match(page, /Save to shelf/);
  assert.match(page, /The story shelf/);
  assert.match(page, /Saved on this device/);
  assert.match(page, /The shelf is ready/);
  assert.match(page, /href="#story-shelf"/);
  assert.match(page, /Opening…" : "Read story"/);
  assert.match(page, /listArchivedStorySummaries\(\)/);
  assert.match(page, /activeStoryLocation === "archive"/);
  assert.match(page, /fetchStoryPlanWithTimeout\("\/api\/generate-story"/);
  assert.match(page, /fetchWithTimeout\("\/api\/generate-page-image"/);
  assert.match(page, /fresh-page-art/);
  assert.doesNotMatch(page, /generated-drawing-card/);
});

test("collapses and persists tonight's recipe with warm family defaults", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /<small id="recipe-title">Tonight’s recipe<\/small>/);
  assert.match(page, /aria-expanded=\{recipeExpanded\} aria-controls="recipe-choices"/);
  assert.match(page, /id="recipe-choices" hidden=\{!recipeExpanded\}/);
  assert.match(page, /onClick=\{\(\) => setRecipeExpanded\(\(expanded\) => !expanded\)\}/);
  assert.match(page, /const DEFAULT_RECIPE: RecipePreferences = \{[\s\S]*?worldMode: "surprise",[\s\S]*?addBadGuy: true,[\s\S]*?readingLevel: "age-6",[\s\S]*?\};/);
  assert.match(page, /const RECIPE_PREFERENCES_KEY = "storygen2-tonights-recipe"/);
  assert.match(page, /window\.localStorage\.getItem\(RECIPE_PREFERENCES_KEY\)/);
  assert.match(page, /if \(!recipePreferencesLoaded\) return;/);
  assert.match(page, /window\.localStorage\.setItem\(RECIPE_PREFERENCES_KEY, JSON\.stringify\(recipe\)\)/);
  assert.match(page, /normalizeRecipePreferences\(JSON\.parse\(storedRecipe\)\)/);
  assert.match(page, /worldMode: candidate\.worldMode === "chosen" \? "chosen" : "surprise"/);
  assert.match(page, /readingLevel: candidate\.readingLevel === "age-7-9" \? "age-7-9" : "age-6"/);
  assert.match(page, /className="recipe-sheet-actions"/);
  assert.match(page, />Done<\/button>/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.recipe-sheet \{[\s\S]*?position: fixed;[\s\S]*?max-height: 82dvh;[\s\S]*?overflow-y: auto;/);
  assert.match(styles, /\.recipe-sheet-actions \{[\s\S]*?position: sticky;[\s\S]*?bottom: 0;/);
});

test("uses one exact-version line-icon language and in-app confirmations", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const lockfile = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));

  assert.equal(manifest.dependencies["lucide-react"], "1.25.0");
  assert.equal(lockfile.packages["node_modules/lucide-react"].version, "1.25.0");
  assert.match(page, /from "lucide-react"/);
  assert.match(page, /function AppIcon\(/);
  assert.doesNotMatch(page, /\p{Extended_Pictographic}/u);
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(page, /kind: "replace-draft"/);
  assert.match(page, /kind: "discard-draft"/);
  assert.match(page, /kind: "remove-archive"/);
  assert.match(page, /role="dialog" aria-modal="true"/);
  assert.match(page, /ref=\{confirmDialog\}/);
  assert.match(page, /querySelectorAll<HTMLButtonElement>\("button:not\(:disabled\)"\)/);
  assert.match(page, /document\.body\.style\.overflow = "hidden"/);
  assert.match(page, /event\.key === "Escape" && !confirmBusy/);
  assert.match(page, /event\.key !== "Tab"/);
});

test("keeps canonical references server-side and only retries failed page art on request", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/generate-page-image/route.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

  assert.doesNotMatch(page, /childReferenceDataUrl|villainReferenceDataUrl|loadReferenceDataUrl/);
  assert.match(route, /loadCanonicalReferences/);
  assert.match(route, /runtimeEnv\.ASSETS/);
  assert.match(worker, /PRIVATE_REFERENCE_PATHS/);
  assert.match(worker, /url\.searchParams\.get\("url"\)/);
  assert.match(worker, /isPrivateReferencePath\(assetUrl\.pathname\)/);
  assert.match(viteConfig, /run_worker_first/);

  // An automatic effect must leave an errored page alone, while the visible
  // retry button deliberately opts back into another request.
  assert.match(page, /async \(index: number, retry = false\)/);
  assert.match(page, /\(!retry && storyPage\.illustrationStatus === "error"\)/);
  assert.match(page, /onClick=\{\(\) => void paintPage\(page, true\)\}/);
});

test("protects the public paid-generation routes with durable anonymous limits", async () => {
  const storyRoute = await readFile(new URL("../app/api/generate-story/route.ts", import.meta.url), "utf8");
  const pageRoute = await readFile(new URL("../app/api/generate-page-image/route.ts", import.meta.url), "utf8");
  const allowanceRoute = await readFile(new URL("../app/api/story-allowance/route.ts", import.meta.url), "utf8");
  const guard = await readFile(new URL("../app/api/abuse-guard.ts", import.meta.url), "utf8");
  const hosting = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));

  assert.equal(hosting.d1, "DB");
  assert.match(storyRoute, /claimStoryGeneration/);
  assert.match(pageRoute, /claimPageGeneration/);
  assert.match(allowanceRoute, /getStoryGenerationAllowance/);
  assert.match(allowanceRoute, /"Cache-Control": "no-store"/);
  assert.match(allowanceRoute, /availableNow: allowance\.availableNow/);
  assert.match(guard, /export const STORY_CLIENT_LIMIT = 8/);
  assert.match(guard, /export const STORY_GLOBAL_LIMIT = 24/);
  assert.match(guard, /const STORY_PAGE_COUNT = 9/);
  assert.match(guard, /export const PAGE_CLIENT_LIMIT = STORY_CLIENT_LIMIT \* STORY_PAGE_COUNT/);
  assert.match(guard, /export const PAGE_GLOBAL_LIMIT = STORY_GLOBAL_LIMIT \* STORY_PAGE_COUNT/);
  assert.match(guard, /export const ART_TOKEN_LIMIT = 14/);
  assert.match(guard, /export const ART_PAGE_LIMIT = 3/);
  assert.match(guard, /STORY_GLOBAL_LIMIT/);
  assert.match(guard, /PAGE_GLOBAL_LIMIT/);
  assert.doesNotMatch(guard, /drawingDataUrl|drawingSummary|visualBible|imageDataUrl/);
});

test("shows the authoritative 24-hour story allowance beside the start action", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /fetch\("\/api\/story-allowance"/);
  assert.match(page, /cache: "no-store"/);
  assert.match(page, /window\.addEventListener\("focus", refreshWhenVisible\)/);
  assert.match(page, /document\.addEventListener\("visibilitychange", refreshWhenVisible\)/);
  assert.match(page, /const startedStory = await[\s\S]*?fetchStoryPlanWithTimeout[\s\S]*?finally \{[\s\S]*?void refreshStoryAllowance\(\)/);
  assert.match(page, /id="story-allowance-status"/);
  assert.match(page, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(page, /aria-describedby="story-allowance-status"/);
  assert.match(page, /No story starts left in this 24-hour allowance/);
  assert.match(page, /left in the family’s 24-hour allowance/);
  assert.match(page, /disabled=\{!drawingUrl \|\| storyAllowanceBlocked\}/);
  assert.match(styles, /\.story-allowance \{[\s\S]*?font-size: var\(--type-caption\);/);
  assert.match(styles, /\.story-allowance\.available \{[\s\S]*?var\(--success-ink\)/);
  assert.match(styles, /\.story-allowance\.blocked \{[\s\S]*?var\(--error-ink\)/);
});

test("polls resumable story planning without extending page-art requests", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const statusRoute = await readFile(new URL("../app/api/generate-story-status/route.ts", import.meta.url), "utf8");

  assert.match(page, /const STORY_PLAN_TIMEOUT_MS = 8 \* 60 \* 1000;/);
  assert.match(page, /const STORY_PLAN_REQUEST_TIMEOUT_MS = 25_000;/);
  assert.match(page, /const PAGE_ART_TIMEOUT_MS = 150_000;/);
  assert.match(
    page,
    /fetchStoryPlanWithTimeout\("\/api\/generate-story", \{[\s\S]*?\n\s*\}, STORY_PLAN_REQUEST_TIMEOUT_MS, controller\);/,
  );
  assert.match(page, /fetchStoryPlanWithTimeout\("\/api\/generate-story-status"/);
  assert.match(page, /isStoryPlanJobResponse\(planResult\)/);
  assert.match(page, /StoryGen lost the connection for a moment/);
  assert.match(page, /requestId: startRequestId/);
  assert.match(page, /classifyStoryPlanUpdate\(planResult, response\.status, nextPlanResult\)/);
  assert.match(page, /cancelBackgroundStoryJob\(jobToken\)/);
  assert.match(statusRoute, /export async function POST/);
  assert.match(statusRoute, /export async function DELETE/);
  assert.match(
    page,
    /fetchWithTimeout\("\/api\/generate-page-image", \{[\s\S]*?\n\s*\}, PAGE_ART_TIMEOUT_MS, controller\);/,
  );
});

test("supports a resumable bedtime reader with anchored background art", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const storage = await readFile(new URL("../app/story-storage.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(page, /artReferenceDataUrl: artDrawingUrl/);
  assert.match(page, /pageOneAnchorDataUrl, pageOneAnchorToken/);
  assert.match(page, /const PAGE_ART_CONCURRENCY = 4;/);
  assert.match(page, /artRequests\.current\.size >= PAGE_ART_CONCURRENCY/);
  assert.match(page, /PAGE_ART_CONCURRENCY - artRequests\.current\.size/);
  assert.match(page, /if \(artControllers\.current\.get\(index\) === controller\) \{[\s\S]*?artRequests\.current\.delete\(index\)/);
  assert.match(page, /loadStoredStory\(\)/);
  assert.match(page, /saveStoredStory\(record\)/);
  assert.match(page, /storyPersistenceRun/);
  assert.match(page, /aria-live="polite" aria-atomic="true"/);
  assert.match(page, /Screen Wake Lock permission/);
  assert.match(page, /requestPending/);
  assert.match(page, /nextLock\.addEventListener\?\.\("release"/);
  assert.match(page, /onTouchStart=\{handleTouchStart\}/);
  assert.match(page, /Read from here/);
  assert.match(page, /Surprise world/);
  assert.match(page, /interests: selectedInterests/);
  assert.match(storage, /writeQueue = writeQueue[\s\S]*?store.delete/);
  assert.match(storage, /expectedStoryId && current.id !== expectedStoryId/);
  assert.match(layout, /nightModeBootstrap/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(styles, /html.storygen-night/);
  assert.match(styles, /reader-controls .turn-button/);
  assert.doesNotMatch(page, /character-reference\.webp/);
  assert.match(storage, /indexedDB\.open/);
  assert.match(storage, /transaction\.oncomplete = \(\) => resolve\(result\)/);
  assert.match(storage, /expiresAt <= Date\.now\(\)/);
  assert.match(styles, /\.night-mode/);
  assert.match(styles, /\.page-dots button,[\s\S]*?\.page-dots button\.active \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(storage, /readingLevel\?: "age-6" \| "age-7-9"/);
  assert.match(storage, /const ARCHIVE_KEY_PREFIX = "archive:"/);
  assert.match(storage, /const ARCHIVE_SUMMARY_KEY_PREFIX = "archive-summary:"/);
  assert.match(storage, /export const MAX_ARCHIVED_STORIES = 8/);
  assert.match(storage, /export async function archiveStoredStory/);
  assert.match(storage, /export async function saveArchivedStory/);
  assert.match(storage, /export async function removeArchivedStory/);
  assert.match(storage, /This picture wasn’t finished before its art pass ended/);
  assert.match(storage, /drawingDataUrl: shouldScrubArtPass \? ""/);
  assert.match(styles, /\.reading-level-picker/);
  assert.match(styles, /min-height: 100dvh/);
  assert.match(styles, /\.recipe-row p \{[\s\S]*?min-width: 0/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.reading-level-options \{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(styles, /\.sample-link-row/);
  assert.match(styles, /\.story-shelf/);
  assert.match(styles, /\.shelf-save-button/);
});

test("keeps completed story illustrations free of decorative overlays", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /<img className="fresh-page-art" src=\{current\.image\} alt=\{current\.alt\}/);
  assert.doesNotMatch(page, /Fresh illustration · page/);
  assert.doesNotMatch(page, /<b>Inspired by:<\/b>/);
  assert.doesNotMatch(page, /generated-scenario-icon|fresh-art-badge|drawing-summary/);
  assert.doesNotMatch(styles, /\.generated-scenario-icon|\.fresh-art-badge|\.drawing-summary/);
});

test("uses consolidated handmade studio tokens and a complete 18:00 night identity", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(layout, /new Date\(\)\.getHours\(\)>=18/);
  assert.match(page, /new Date\(\)\.getHours\(\) >= 18/);
  assert.doesNotMatch(layout, /Geist_Mono/);
  assert.doesNotMatch(styles, /\.drawing-sticker/);

  const typeTokens = [...styles.matchAll(/--type-(caption|small|body|lead|heading|display):/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(typeTokens)].sort(), ["body", "caption", "display", "heading", "lead", "small"]);
  const radiusTokens = [...styles.matchAll(/--radius-([a-z-]+):/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(radiusTokens)].sort(), ["paper", "pill", "standard"]);
  const shadowTokens = [...styles.matchAll(/--shadow-([a-z-]+):/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(shadowTokens)].sort(), ["lifted", "resting"]);
  const rotationTokens = [...styles.matchAll(/--rotate-([a-z-]+):/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(rotationTokens)].sort(), ["gentle", "playful"]);

  const radiusUses = [...styles.matchAll(/border-radius:\s*([^;]+);/g)].map((match) => match[1].trim());
  assert.ok(radiusUses.length > 0);
  assert.ok(radiusUses.every((value) => /^var\(--radius-(?:paper|standard|pill)\)$/.test(value)));
  const shadowUses = [...styles.matchAll(/box-shadow:\s*([^;]+);/g)].map((match) => match[1].trim());
  assert.ok(shadowUses.length > 0);
  assert.ok(shadowUses.every((value) => /^var\(--shadow-(?:resting|lifted)\)$/.test(value)));
  const rotationUses = [...styles.matchAll(/rotate\(([^)]+(?:\)[^)]*)?)\)/g)].map((match) => match[1]);
  assert.ok(rotationUses.length > 0);
  assert.ok(rotationUses.every((value) => /--rotate-(?:gentle|playful)/.test(value)));

  assert.match(styles, /--font-display: Georgia/);
  assert.match(styles, /html\.storygen-night,[\s\S]*?--desk: #10192b;[\s\S]*?--coral: #d85a30;[\s\S]*?--yellow: #e9d98c;[\s\S]*?--teal: #66b9b0;[\s\S]*?--blue: #93b7e7;[\s\S]*?--focus-ring: #e9d98c;/);
  assert.match(styles, /\.upload-paper \{[\s\S]*?border-radius: var\(--radius-paper\);[\s\S]*?transform: rotate\(var\(--rotate-gentle\)\)/);
  assert.match(styles, /\.tape-left/);
  assert.match(styles, /\.tape-right/);
  assert.match(styles, /\.story-start-dock \{[\s\S]*?position: sticky;[\s\S]*?bottom: max\(var\(--space-3\), env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-duration: \.01ms !important;[\s\S]*?transition-duration: \.01ms !important;/);
});

test("shows real shelf covers and gives page nine a saved moral finish", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const storage = await readFile(new URL("../app/story-storage.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.ok(page.indexOf('className="story-shelf"') < page.indexOf('className="sample-link-row"'));
  assert.match(page, /story\.coverImage \? <img src=\{story\.coverImage\} alt="" \/>/);
  assert.match(page, /<figcaption>\{story\.title\}<\/figcaption>/);
  assert.match(page, /libraryLoaded \? hasFamilyStories \? <section className="sample-link-row"/);
  assert.match(page, /<AppIcon icon=\{BookOpen\} \/>Read the sample/);
  assert.doesNotMatch(page, />STORYGEN</);
  assert.match(styles, /\.story-shelf-card:nth-child\(odd\) \.story-shelf-book \{[\s\S]*?--rotate-gentle/);
  assert.match(styles, /\.story-shelf-card:nth-child\(even\) \.story-shelf-book \{[\s\S]*?--rotate-gentle/);
  assert.match(styles, /\.story-shelf-book figcaption \{[\s\S]*?var\(--font-display\)/);

  assert.match(page, /isLast \? <section className=\{`story-finish/);
  assert.match(page, /<h2>The End<\/h2><p>\{storyMoral \|\| SAMPLE_MORAL\}<\/p>/);
  assert.match(page, /"Save to shelf"/);
  assert.match(page, />Read again<\/button>/);
  assert.match(page, />Good night<\/button>/);
  assert.match(page, /moral: result\.moral/);
  assert.match(page, /moral: storyMoral/);
  assert.match(page, /async function createCoverThumbnail/);
  assert.match(page, /480 \/ Math\.max\(image\.naturalWidth, image\.naturalHeight\)/);
  assert.match(page, /canvas\.toDataURL\("image\/jpeg", 0\.76\)/);
  assert.match(page, /coverImage: storyCoverImage \|\| activeStory\[0\]\?\.image/);

  assert.match(storage, /moral\?: string/);
  assert.match(storage, /coverImage\?: string/);
  assert.match(storage, /coverImage: story\.coverImage \|\| story\.pages\[0\]\?\.image/);
  assert.match(storage, /moral: incoming\.moral \|\| existing\.moral/);
  assert.match(storage, /coverImage: incoming\.coverImage \|\| incoming\.pages\[0\]\?\.image \|\| existing\.coverImage \|\| existing\.pages\[0\]\?\.image/);
});

test("explains when the private OpenAI connection is missing", async () => {
  const response = await createStoryResponse(
    new Request("http://localhost/api/generate-story", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: "data:image/jpeg;base64,AAAA",
        scenario: "brick-city",
        badGuy: null,
      }),
    }),
    { apiKey: "" },
  );

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OpenAI connection/i);
});

test("stops paid story generation when the spending guard denies a request", async () => {
  let providerCalled = false;
  const response = await createStoryResponse(
    new Request("http://localhost/api/generate-story", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: "data:image/jpeg;base64,AAAA",
        scenario: "brick-city",
        badGuy: null,
      }),
    }),
    {
      apiKey: "test-key",
      claimGeneration: async () => ({ ok: false, status: 429, error: "Credit guard test", retryAfterSeconds: 60 }),
      fetchImpl: async () => { providerCalled = true; },
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(providerCalled, false);
});

test("sends the uploaded picture to OpenAI and returns nine generated pages", async () => {
  let openAIRequest;
  const generatedStory = makeGeneratedStory("The Blue Loop Machine", {
    scenarioTitle: "Turbo Car Lab",
    badGuyName: "The Gruff Gear King",
  });

  const fetchImpl = async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses");
    openAIRequest = JSON.parse(String(init?.body));
    return Response.json({
      output: [{
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(generatedStory) }],
      }],
    });
  };

  const response = await createStoryResponse(
      new Request("http://localhost/api/generate-story", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: "data:image/jpeg;base64,AAAA",
          scenario: "turbo-lab",
          badGuy: "gear-king",
        }),
      }),
      { apiKey: "test-key", fetchImpl },
  );

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.title, generatedStory.title);
  assert.equal(result.pages.length, 9);
  assert.equal(typeof result.artToken, "string");
  assert.equal(openAIRequest.model, "gpt-5.6-terra");
  assert.deepEqual(openAIRequest.reasoning, { effort: "low" });
  assert.equal(openAIRequest.store, false);
  assert.equal(openAIRequest.input[0].content[1].image_url, "data:image/jpeg;base64,AAAA");
  assert.match(openAIRequest.input[0].content[0].text, /Turbo Car Lab/);
  assert.match(openAIRequest.input[0].content[0].text, /Gruff Gear King/);
  assert.equal(openAIRequest.text.format.type, "json_schema");
});

test("treats a parent supplied name as authoritative", async () => {
  let openAIRequest;
  const generatedStory = makeGeneratedStory("Messi");
  const fetchImpl = async (_input, init) => {
    openAIRequest = JSON.parse(String(init?.body));
    return Response.json({
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(generatedStory) }] }],
    });
  };

  const response = await createStoryResponse(
    new Request("http://localhost/api/generate-story", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: "data:image/jpeg;base64,AAAA",
        drawingHint: "  Messi  ",
        scenario: "brick-city",
        badGuy: null,
      }),
    }),
    { apiKey: "test-key", fetchImpl },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).creationName, "Messi");
  assert.match(openAIRequest.input[0].content[0].text, /Treat this label as authoritative/);
  assert.match(openAIRequest.input[0].content[0].text, /"Messi"/);
});

test("rejects a story that changes an authoritative name", async () => {
  const generatedStory = makeGeneratedStory("Messic");
  const fetchImpl = async () => Response.json({
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(generatedStory) }] }],
  });

  const response = await createStoryResponse(
    new Request("http://localhost/api/generate-story", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: "data:image/jpeg;base64,AAAA",
        drawingHint: "Messi",
        scenario: "brick-city",
        badGuy: null,
      }),
    }),
    { apiKey: "test-key", fetchImpl },
  );

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /did not keep.*Messi/i);
});

test("creates fresh page art from the child, drawing, and villain references", async () => {
  const drawingDataUrl = "data:image/jpeg;base64,AAAA";
  const pageOneAnchorDataUrl = `data:image/webp;base64,${"D".repeat(160)}`;
  const story = makeGeneratedStory();
  const artToken = await createArtToken({
    story,
    drawingHint: "Blue Loop Machine",
    drawingDataUrl,
    scenario: "moon-base",
    badGuy: "brick-snatcher",
  }, "test-key");
  const pageOneAnchorToken = await createPageOneAnchorToken({
    artToken,
    imageDataUrl: pageOneAnchorDataUrl,
  }, "test-key");
  let imageRequest;
  const fetchImpl = async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/images/edits");
    imageRequest = init.body;
    return Response.json({ data: [{ b64_json: "A".repeat(160) }] });
  };
  const pageImageOptions = {
    apiKey: "test-key",
    fetchImpl,
    loadCanonicalReferences: async (badGuy) => {
      assert.equal(badGuy, "brick-snatcher");
      return {
        child: new Blob(["C".repeat(160)], { type: "image/webp" }),
        villain: new Blob(["V".repeat(160)], { type: "image/webp" }),
      };
    },
  };

  const response = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        artToken,
        pageNumber: 6,
        drawingDataUrl,
        pageOneAnchorDataUrl,
        pageOneAnchorToken,
      }),
    }),
    pageImageOptions,
  );

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.pageNumber, 6);
  assert.match(result.imageDataUrl, /^data:image\/webp;base64,/);
  assert.equal(imageRequest.get("model"), "gpt-image-2");
  assert.equal(imageRequest.get("quality"), "low");
  assert.equal(imageRequest.getAll("image[]").length, 4);
  assert.match(imageRequest.get("prompt"), /completely fresh scene/i);
  assert.match(imageRequest.get("prompt"), /Sam must be clearly visible/i);
  assert.match(imageRequest.get("prompt"), /Blue Loop Machine/i);
  assert.match(imageRequest.get("prompt"), /Brick Snatcher/i);
  assert.match(imageRequest.get("prompt"), /three distinct focal characters/i);
  assert.match(imageRequest.get("prompt"), /creation is not the villain/i);
  assert.match(imageRequest.get("prompt"), /Adventure page 6/i);
  assert.match(imageRequest.get("prompt"), /Moon Base Builders/i);
  assert.match(imageRequest.get("prompt"), /single fear peak/i);
  assert.match(imageRequest.get("prompt"), /most spooky and imposing/i);
  assert.match(imageRequest.get("prompt"), /visible safe space around Sam/i);
  assert.match(imageRequest.get("prompt"), /no physical contact, weapons, realistic horror, or threatening teeth/i);
  assert.match(imageRequest.get("prompt"), /signed page-one consistency anchor/i);
  assert.ok(imageRequest.get("prompt").includes(story.visualBible));
  for (const descriptor of story.creationDescriptors) assert.ok(imageRequest.get("prompt").includes(descriptor));
  assert.ok(imageRequest.get("prompt").includes(story.pages[5].mood));
  assert.match(imageRequest.get("prompt"), /Sam is a fictional six-year-old child with dark brown skin, springy black curls, round teal glasses/);
  assert.doesNotMatch(JSON.stringify([...imageRequest.keys()]), /childReferenceDataUrl|villainReferenceDataUrl/);

  const resolutionResponse = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        artToken,
        pageNumber: 8,
        drawingDataUrl,
        pageOneAnchorDataUrl,
        pageOneAnchorToken,
      }),
    }),
    pageImageOptions,
  );
  assert.equal(resolutionResponse.status, 200);
  assert.match(imageRequest.get("prompt"), /Soften the villain’s posture, expression, lighting, and shadow/i);
  assert.doesNotMatch(imageRequest.get("prompt"), /single fear peak/i);
});

test("uses the deployment child identity in page-art prompts", async () => {
  const drawingDataUrl = "data:image/jpeg;base64,AAAA";
  const story = makeGeneratedStory();
  const artToken = await createArtToken({
    story,
    drawingHint: "",
    drawingDataUrl,
    scenario: "doodle-island",
    badGuy: null,
  }, "test-key");
  let imagePrompt = "";

  const response = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artToken, pageNumber: 1, drawingDataUrl }),
    }),
    {
      apiKey: "test-key",
      childConfig: {
        STORY_CHILD_NAME: "Avery",
        STORY_CHILD_APPEARANCE: "{name} has silver curls, amber glasses, green overalls, and purple sneakers.",
      },
      loadCanonicalReferences: async () => makeCanonicalReferences(),
      fetchImpl: async (_input, init) => {
        imagePrompt = init.body.get("prompt");
        return Response.json({ data: [{ b64_json: "A".repeat(160) }] });
      },
    },
  );

  assert.equal(response.status, 200);
  assert.match(imagePrompt, /canonical cartoon character sheet for Avery/);
  assert.match(imagePrompt, /Avery has silver curls, amber glasses, green overalls, and purple sneakers/);
  assert.match(imagePrompt, /Avery must be clearly visible/);
});

test("creates a signed page-one anchor and requires it for every later page", async () => {
  const drawingDataUrl = "data:image/jpeg;base64,AAAA";
  const story = makeGeneratedStory();
  const artToken = await createArtToken({
    story,
    drawingHint: "",
    drawingDataUrl,
    scenario: "turbo-lab",
    badGuy: null,
  }, "test-key");
  let providerCalls = 0;
  const fetchImpl = async () => {
    providerCalls += 1;
    return Response.json({ data: [{ b64_json: "A".repeat(160) }] });
  };
  const baseOptions = {
    apiKey: "test-key",
    fetchImpl,
    loadCanonicalReferences: async () => makeCanonicalReferences(),
  };

  const pageOneResponse = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artToken, pageNumber: 1, drawingDataUrl }),
    }),
    baseOptions,
  );
  assert.equal(pageOneResponse.status, 200);
  const pageOne = await pageOneResponse.json();
  assert.equal(typeof pageOne.pageOneAnchorToken, "string");

  const missingAnchorResponse = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artToken, pageNumber: 2, drawingDataUrl }),
    }),
    baseOptions,
  );
  assert.equal(missingAnchorResponse.status, 400);
  assert.match((await missingAnchorResponse.json()).error, /page one/i);

  const mismatchedAnchorResponse = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        artToken,
        pageNumber: 2,
        drawingDataUrl,
        pageOneAnchorDataUrl: "data:image/webp;base64,DIFFERENT",
        pageOneAnchorToken: pageOne.pageOneAnchorToken,
      }),
    }),
    baseOptions,
  );
  assert.equal(mismatchedAnchorResponse.status, 403);
  assert.equal(providerCalls, 1);
});

test("retries only transient provider failures and makes at most two attempts", async () => {
  const drawingDataUrl = "data:image/jpeg;base64,AAAA";
  const story = makeGeneratedStory();
  const artToken = await createArtToken({
    story,
    drawingHint: "",
    drawingDataUrl,
    scenario: "turbo-lab",
    badGuy: null,
  }, "test-key");
  const requestForPageOne = () => new Request("http://localhost/api/generate-page-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ artToken, pageNumber: 1, drawingDataUrl }),
  });

  let transientCalls = 0;
  const transientResponse = await createPageImageResponse(requestForPageOne(), {
    apiKey: "test-key",
    loadCanonicalReferences: async () => makeCanonicalReferences(),
    randomImpl: () => 0,
    sleepImpl: async () => {},
    fetchImpl: async () => {
      transientCalls += 1;
      if (transientCalls === 1) {
        return Response.json(
          { error: { code: "server_error", type: "server_error" } },
          { status: 500, headers: { "x-request-id": "req_transient" } },
        );
      }
      return Response.json({ data: [{ b64_json: "A".repeat(160) }] });
    },
  });
  assert.equal(transientResponse.status, 200);
  assert.equal(transientCalls, 2);

  let userErrorCalls = 0;
  const userErrorResponse = await createPageImageResponse(requestForPageOne(), {
    apiKey: "test-key",
    loadCanonicalReferences: async () => makeCanonicalReferences(),
    sleepImpl: async () => {},
    fetchImpl: async () => {
      userErrorCalls += 1;
      return Response.json(
        { error: { code: "image_generation_user_error", type: "image_generation_user_error" } },
        { status: 500, headers: { "x-request-id": "req_user_error" } },
      );
    },
  });
  assert.equal(userErrorResponse.status, 502);
  assert.equal(userErrorCalls, 1);

  let quotaCalls = 0;
  const quotaResponse = await createPageImageResponse(requestForPageOne(), {
    apiKey: "test-key",
    loadCanonicalReferences: async () => makeCanonicalReferences(),
    sleepImpl: async () => {},
    fetchImpl: async () => {
      quotaCalls += 1;
      return Response.json(
        { error: { code: "insufficient_quota", type: "insufficient_quota" } },
        { status: 429 },
      );
    },
  });
  assert.equal(quotaResponse.status, 429);
  assert.equal(quotaCalls, 1);

  let throttledCalls = 0;
  const throttledResponse = await createPageImageResponse(requestForPageOne(), {
    apiKey: "test-key",
    loadCanonicalReferences: async () => makeCanonicalReferences(),
    randomImpl: () => 0,
    sleepImpl: async () => {},
    fetchImpl: async () => {
      throttledCalls += 1;
      return Response.json(
        { error: { code: "rate_limit_exceeded", type: "rate_limit_error" } },
        { status: 429 },
      );
    },
  });
  assert.equal(throttledResponse.status, 429);
  assert.equal(throttledCalls, 2);
});

test("cancels a page-art provider call at the server deadline without retrying", async () => {
  const drawingDataUrl = "data:image/jpeg;base64,AAAA";
  const story = makeGeneratedStory();
  const artToken = await createArtToken({
    story,
    drawingHint: "",
    drawingDataUrl,
    scenario: "turbo-lab",
    badGuy: null,
  }, "test-key");
  let providerCalls = 0;
  const response = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artToken, pageNumber: 1, drawingDataUrl }),
    }),
    {
      apiKey: "test-key",
      providerTimeoutMs: 10,
      loadCanonicalReferences: async () => makeCanonicalReferences(),
      fetchImpl: async (_input, init) => {
        providerCalls += 1;
        await new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      },
    },
  );
  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /too long/i);
  assert.equal(providerCalls, 1);
});

test("keeps the page-art deadline active while reading the provider response body", async () => {
  const drawingDataUrl = "data:image/jpeg;base64,AAAA";
  const story = makeGeneratedStory();
  const artToken = await createArtToken({
    story,
    drawingHint: "",
    drawingDataUrl,
    scenario: "turbo-lab",
    badGuy: null,
  }, "test-key");
  let providerCalls = 0;
  const response = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artToken, pageNumber: 1, drawingDataUrl }),
    }),
    {
      apiKey: "test-key",
      providerTimeoutMs: 10,
      loadCanonicalReferences: async () => makeCanonicalReferences(),
      fetchImpl: async (_input, init) => {
        providerCalls += 1;
        return {
          json: () => new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
          }),
        };
      },
    },
  );
  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /too long/i);
  assert.equal(providerCalls, 1);
});

test("rejects page-art requests that do not match their signed story", async () => {
  const drawingDataUrl = "data:image/jpeg;base64,AAAA";
  const story = makeGeneratedStory();
  const artToken = await createArtToken({
    story,
    drawingHint: "",
    drawingDataUrl,
    scenario: "turbo-lab",
    badGuy: null,
  }, "test-key");
  let called = false;

  const response = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        artToken,
        pageNumber: 1,
        drawingDataUrl: "data:image/jpeg;base64,DIFFERENT",
        childReferenceDataUrl: "data:image/webp;base64,BBBB",
      }),
    }),
    { apiKey: "test-key", fetchImpl: async () => { called = true; } },
  );

  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test("stops paid page artwork when the spending guard denies a valid art pass", async () => {
  const drawingDataUrl = "data:image/jpeg;base64,AAAA";
  const story = makeGeneratedStory();
  const artToken = await createArtToken({
    story,
    drawingHint: "",
    drawingDataUrl,
    scenario: "turbo-lab",
    badGuy: null,
  }, "test-key");
  let referencesLoaded = false;
  let providerCalled = false;
  const response = await createPageImageResponse(
    new Request("http://localhost/api/generate-page-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ artToken, pageNumber: 1, drawingDataUrl }),
    }),
    {
      apiKey: "test-key",
      claimGeneration: async () => ({ ok: false, status: 429, error: "Credit guard test", retryAfterSeconds: 90, reason: "page-global" }),
      loadCanonicalReferences: async () => { referencesLoaded = true; return makeCanonicalReferences(); },
      fetchImpl: async () => { providerCalled = true; },
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "90");
  assert.deepEqual(await response.json(), {
    error: "Credit guard test",
    limitReason: "page-global",
    retryAfterSeconds: 90,
  });
  assert.equal(referencesLoaded, false);
  assert.equal(providerCalled, false);
});

test("explains when the configured OpenAI account has no API quota", async () => {
  const fetchImpl = async () => Response.json(
    {
      error: {
        type: "insufficient_quota",
        code: "insufficient_quota",
        message: "You exceeded your current quota, please check your plan and billing details.",
      },
    },
    { status: 429 },
  );

  const response = await createStoryResponse(
    new Request("http://localhost/api/generate-story", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: "data:image/jpeg;base64,AAAA",
        scenario: "brick-city",
        badGuy: null,
      }),
    }),
    { apiKey: "test-key", fetchImpl },
  );

  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /no API credits/i);
});
