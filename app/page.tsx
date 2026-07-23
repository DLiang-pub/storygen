"use client";

import { ChangeEvent, DragEvent, TouchEvent as ReactTouchEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BicepsFlexed,
  Blocks,
  Bone,
  BookOpen,
  Bookmark,
  Bot,
  BrickWall,
  Bug,
  Camera,
  CarFront,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Cloud,
  Cog,
  Dice5,
  Factory,
  Ghost,
  ImageUp,
  Landmark,
  Library,
  Medal,
  Moon,
  PackageOpen,
  Palette,
  PawPrint,
  PencilLine,
  Pickaxe,
  Play,
  Plus,
  Puzzle,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  ToyBrick,
  Trash2,
  WavesHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { classifyStoryPlanUpdate } from "./story-plan-update.js";
import {
  archiveStoredStory,
  ArchivedStorySummary,
  clearStoredStory,
  listArchivedStorySummaries,
  loadArchivedStory,
  loadStoredStory,
  MAX_ARCHIVED_STORIES,
  removeArchivedStory,
  saveArchivedStory,
  saveStoredStory,
  StoredStory,
} from "./story-storage";

type IllustrationStatus = "idle" | "loading" | "ready" | "error";
type StoryPage = {
  title: string;
  text: string;
  image?: string;
  alt: string;
  sound?: string;
  illustrationPrompt?: string;
  illustrationStatus?: IllustrationStatus;
  illustrationError?: string;
};
type GeneratedStoryResponse = {
  title: string;
  creationName: string;
  drawingSummary: string;
  visualBible: string;
  moral: string;
  readingLevel: ReadingLevel;
  artToken: string;
  pages: Array<{ title: string; text: string; imageAlt: string; illustrationPrompt: string; sound: string }>;
};
type StoryPlanJobResponse = {
  status: "queued" | "in_progress";
  jobToken: string;
  retryAfterMs?: number;
  error?: string;
};
type GeneratedPageImageResponse = {
  pageNumber: number;
  imageDataUrl: string;
  pageOneAnchorToken?: string;
  error?: string;
  limitReason?: "page-client" | "page-global" | "art-token" | "art-page";
  retryAfterSeconds?: number;
};
type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void, options?: { once?: boolean }) => void;
};
type StoryAllowanceBucket = { limit: number; remaining: number; resetsAt: number | null };
type StoryAllowance = {
  availableNow: boolean;
  daily: StoryAllowanceBucket;
  hourly: StoryAllowanceBucket;
};
type StoryAllowanceStatus = "loading" | "ready" | "unavailable";

type Scenario = { id: string; icon: LucideIcon; title: string; hook: string };
type BadGuy = { id: string; icon: LucideIcon; name: string; description: string };
type ReadingLevel = "age-6" | "age-7-9";
type StoryLocation = "sample" | "current" | "archive";
type RecipePreferences = {
  version: 1;
  worldMode: "surprise" | "chosen";
  scenario: string;
  addBadGuy: boolean;
  badGuy: string;
  interests: string[];
  readingLevel: ReadingLevel;
};
type ConfirmAction =
  | { kind: "replace-draft"; title: string }
  | { kind: "discard-draft"; title: string }
  | { kind: "remove-archive"; story: ArchivedStorySummary };

const STORY_PLAN_TIMEOUT_MS = 8 * 60 * 1000;
const STORY_PLAN_REQUEST_TIMEOUT_MS = 25_000;
const STORY_PLAN_POLL_INTERVAL_MS = 2_000;
const PAGE_ART_TIMEOUT_MS = 150_000;
const PAGE_ART_CONCURRENCY = 4;
const MAX_STORY_EXTRAS = 2;
const FALLBACK_ART_PASS_LIFETIME_MS = 2 * 60 * 60 * 1000;
const NIGHT_MODE_KEY = "storygen2-night-mode";
const RECIPE_PREFERENCES_KEY = "storygen2-tonights-recipe";
const SAMPLE_MORAL = "Big ideas and big feelings work best with a steady breath and a thoughtful plan.";
const DEFAULT_RECIPE: RecipePreferences = {
  version: 1,
  worldMode: "surprise",
  scenario: "brick-city",
  addBadGuy: true,
  badGuy: "brick-snatcher",
  interests: [],
  readingLevel: "age-6",
};

const sampleStory: StoryPage[] = [
  { title: "The best build yet", text: "Sam loved building cars that looked fast even when they were standing still. That evening, they drew their boldest design yet: three wheels, two rocket fins, a low blue canopy, and a secret compartment for emergency bricks. They checked every line the way a master builder checks every connection. “Perfect,” Sam whispered. Then the red crayon car blinked its headlights. The wheels began to hum. The paper rippled like a doorway, and Sam’s careful drawing invited them inside.", sound: "VROOM!", image: "/story/page-1-v2.webp", alt: "Sam drawing a carefully designed red three-wheeled rocket car" },
  { title: "Off the page!", text: "Before Sam could call anyone, the car bounced off the paper and landed on the rug. It was just big enough for one excellent driver. “One quick test drive,” said Sam. They climbed in, tightened an imaginary seat belt, and tapped the smallest glowing button. ZING! A blue-and-gold tunnel spiraled open in the wall. Crayons, blocks, and scraps of paper whirled around them, but Sam held the wheel steady. The three wheels skipped once, twice—then the bedroom vanished behind them.", sound: "WHOOSH!", image: "/story/page-2-v2.webp", alt: "Sam’s crayon rocket car springing from the paper into a glowing doorway" },
  { title: "The missing piece", text: "The tunnel dropped Sam into Brick City, where colorful towers rose like enormous toy builds. They had watched enough block-world adventures—and built enough tricky cars—to know when something was wrong. The great river bridge had collapsed. Friendly cars waited on both banks, unable to cross. Sam studied the fallen arches, sorted the pieces by shape, and spotted the real problem: the curved golden block from the very top was missing. Across the river, tiny purple footprints led toward a lumpy canvas sack.", image: "/story/page-3-v2.webp", alt: "Sam arriving at a fallen Brick City bridge while a small purple troublemaker hides with a golden block" },
  { title: "The Brick Snatcher", text: "The Brick Snatcher bounced out from behind the bridge. Brass goggles wobbled above his eyes, and a patched cape flapped behind him. “I took the golden curve!” he boasted. “It will finish my mega-fortress. Then everyone will know I am the greatest builder!” Sam’s energy shot in ten directions at once. They tried to carry every bridge block and chase the Snatcher at the same time. Blocks tumbled. Plans bumped. “Give it back!” Sam roared, with a feeling as big as thunder.", image: "/story/page-4-v2.webp", alt: "Frustrated Sam holds too many blocks while the silly Brick Snatcher boasts with the golden piece" },
  { title: "Three dragon breaths", text: "Sam wanted to race after him, rebuild the bridge, rescue the cars, and prove they were the better builder—all right now. Their body was moving faster than their plans. Then Sam remembered their wushu stance. Feet wide. Knees soft. Hands near their belly. In… and out. Three slow dragon breaths unwound the thunder inside them. The Brick Snatcher watched from beside his sack. “You’re not chasing me?” he asked. Sam opened their eyes. “Not until I have a better plan.” Now they could see the whole problem.", image: "/story/page-5-v2.webp", alt: "Sam takes three steady wushu breaths while the Brick Snatcher watches curiously" },
  { title: "A builder’s challenge", text: "One red block. Click. One blue block. Click. Sam rebuilt the arch slowly, checking each connection before adding the next. “A real master builder makes something strong enough for everyone,” they called. The Brick Snatcher crept closer. Sam held out a yellow block. “Help me finish. Your golden piece can be the final block.” No one had ever invited the Snatcher to build before. He placed the yellow block crooked. Sam did not laugh. “Turn it once,” they said. CLICK. Perfect. Side by side, they made the bridge stronger than before.", image: "/story/page-6-v2.webp", alt: "Sam and the Brick Snatcher carefully rebuild the bridge together" },
  { title: "The golden shot", text: "Only one gap remained, right at the top. The Brick Snatcher pulled the golden piece from his sack, but the middle of the bridge was too far to reach safely. Sam noticed a badminton racket beside a pile of supplies. A bright idea zipped into place. “Toss it gently,” they said. The Snatcher gulped, then threw. Sam watched the block, steadied their feet, and swung with soft hands. POP! The racket lifted the golden piece in a perfect shining arc. Every car held its breath as it sailed toward the gap.", image: "/story/page-7-v2.webp", alt: "Sam sends the golden bridge block toward its place with a careful badminton shot" },
  { title: "Everyone can cross", text: "The golden block landed with the most satisfying CLICK in Brick City. The bridge stood bright and strong. Instead of grabbing the piece again, the Brick Snatcher folded his empty sack. Cars honked and cheered. Sam led a VROOM-VROOM parade across the river, and the Snatcher joined in the last little car. “Maybe I wasn’t bad at building,” he admitted. “Maybe I was bad at asking.” Sam grinned. “You can practise.” Together they planned a giant community garage with ramps, repair bays, and room for everybody’s best car.", image: "/story/page-8-v2.webp", alt: "Sam and the reformed Brick Snatcher join a joyful parade across the rebuilt bridge" },
  { title: "Sam knows how to steer", text: "The paper doorway carried Sam home just as the room turned golden with evening light. Their rocket car became a drawing again, but a tiny purple thread from the Snatcher’s cape was caught beside one wheel. Sam added a golden star to the page and looked at the bridge model. Big ideas could zoom. Big feelings could thunder. Neither one was bad—but both worked better with a steady breath and a thoughtful plan. Somewhere in Brick City, Sam imagined a new building partner clicking the first block into their garage.", image: "/story/page-9-v2.webp", alt: "Sam adds a golden star to the rocket-car drawing and remembers the adventure" },
];

const interests: Array<{ id: string; icon: LucideIcon; label: string }> = [
  { id: "cars", icon: CarFront, label: "Cars" },
  { id: "brick-builds", icon: ToyBrick, label: "Great builds" },
  { id: "block-worlds", icon: Blocks, label: "Block worlds" },
  { id: "drawing", icon: PencilLine, label: "Drawing" },
  { id: "badminton", icon: Medal, label: "Badminton" },
  { id: "wushu", icon: BicepsFlexed, label: "Wushu" },
  { id: "space", icon: Rocket, label: "Space" },
  { id: "robots", icon: Bot, label: "Robots" },
  { id: "dinosaurs", icon: Bone, label: "Dinosaurs" },
  { id: "ocean", icon: WavesHorizontal, label: "Ocean" },
  { id: "mysteries", icon: Puzzle, label: "Mysteries" },
  { id: "animals", icon: PawPrint, label: "Animals" },
];

const scenarios: Scenario[] = [
  { id: "brick-city", icon: BrickWall, title: "Brick City Rescue", hook: "Repair a giant build before sunset." },
  { id: "block-world", icon: Pickaxe, title: "Block World Quest", hook: "Explore, craft and solve a cave mystery." },
  { id: "turbo-lab", icon: CarFront, title: "Turbo Car Lab", hook: "Design a wild new car and test it." },
  { id: "sky-shuttle", icon: Cloud, title: "Sky Shuttle Rally", hook: "A badminton shot opens a cloud world." },
  { id: "dragon-temple", icon: Landmark, title: "Dragon Temple Trial", hook: "Wushu focus unlocks an ancient puzzle." },
  { id: "doodle-island", icon: PencilLine, title: "Doodle Island Mystery", hook: "Every new line becomes real." },
  { id: "moon-base", icon: Rocket, title: "Moon Base Builders", hook: "Repair a moon rover before the meteor shower." },
  { id: "dinosaur-valley", icon: Bone, title: "Dinosaur Valley Dash", hook: "Guide a lost hatchling through a rumbling valley." },
  { id: "robot-workshop", icon: Factory, title: "Robot Workshop Mystery", hook: "Wake a muddled factory and find its missing part." },
];

const badGuys: BadGuy[] = [
  { id: "brick-snatcher", icon: PackageOpen, name: "The Brick Snatcher", description: "Stalks Brick City after dark, stealing the piece holding it together." },
  { id: "giggle-glitch", icon: Bug, name: "The Giggle Glitch", description: "Creeps through the block world, blinking out lights and twisting paths." },
  { id: "gear-king", icon: Cog, name: "The Gruff Gear King", description: "Chases every challenger across his thunder-dark racetrack." },
];

const readingLevels: Array<{ id: ReadingLevel; label: string; description: string }> = [
  { id: "age-6", label: "Age 6", description: "Clear sentences and playful repetition" },
  { id: "age-7-9", label: "Ages 7–9", description: "Richer words and more detail" },
];

function AppIcon({ icon: Icon, className = "" }: { icon: LucideIcon; className?: string }) {
  return <Icon className={`app-icon ${className}`.trim()} aria-hidden="true" focusable="false" strokeWidth={1.9} />;
}

function normalizeRecipePreferences(value: unknown): RecipePreferences {
  if (!value || typeof value !== "object") return DEFAULT_RECIPE;
  const candidate = value as Partial<RecipePreferences>;
  const scenario = scenarios.some((item) => item.id === candidate.scenario) ? candidate.scenario! : DEFAULT_RECIPE.scenario;
  const badGuy = badGuys.some((item) => item.id === candidate.badGuy) ? candidate.badGuy! : DEFAULT_RECIPE.badGuy;
  const validInterestIds = new Set(interests.map((interest) => interest.id));
  const selectedExtras = Array.isArray(candidate.interests)
    ? [...new Set(candidate.interests.filter((interest): interest is string => typeof interest === "string" && validInterestIds.has(interest)))].slice(0, MAX_STORY_EXTRAS)
    : [];
  return {
    version: 1,
    worldMode: candidate.worldMode === "chosen" ? "chosen" : "surprise",
    scenario,
    addBadGuy: typeof candidate.addBadGuy === "boolean" ? candidate.addBadGuy : DEFAULT_RECIPE.addBadGuy,
    badGuy,
    interests: selectedExtras,
    readingLevel: candidate.readingLevel === "age-7-9" ? "age-7-9" : "age-6",
  };
}

function pickSurpriseScenario() {
  return scenarios[Math.floor(Math.random() * scenarios.length)]?.id ?? DEFAULT_RECIPE.scenario;
}

function storyMoralFallback(pages: StoryPage[]) {
  const finalText = pages.at(-1)?.text.trim() ?? "";
  const sentences = finalText.match(/[^.!?]+[.!?]+/g);
  return sentences?.at(-1)?.trim() || SAMPLE_MORAL;
}

async function prepareDrawing(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a picture file.");
  if (file.size > 12 * 1024 * 1024) throw new Error("That picture is too large. Please choose one under 12 MB.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("That picture could not be opened. Try a JPG, PNG, or WebP image."));
      nextImage.src = objectUrl;
    });
    const renderAt = (maximumEdge: number, quality: number) => {
      const scale = Math.min(1, maximumEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not prepare the picture.");
      context.fillStyle = "#fffdf8";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    };
    return {
      planningDataUrl: renderAt(1600, 0.88),
      artReferenceDataUrl: renderAt(768, 0.86),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function createCoverThumbnail(imageDataUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("The cover preview could not be prepared."));
    nextImage.src = imageDataUrl;
  });
  const scale = Math.min(1, 480 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return imageDataUrl;
  context.fillStyle = "#fffaf0";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.76);
}

class StoryCancelledError extends Error {}
class StoryConnectionError extends Error {
  retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}
class StoryRequestTimeoutError extends Error {}
const explicitlyCancelledRequests = new WeakSet<AbortController>();

function cancelRequest(controller: AbortController) {
  explicitlyCancelledRequests.add(controller);
  controller.abort();
}

async function withRequestTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  controller = new AbortController(),
) {
  let timedOut = false;
  const requestController = new AbortController();
  const forwardAbort = () => requestController.abort(controller.signal.reason);
  if (controller.signal.aborted) forwardAbort();
  else controller.signal.addEventListener("abort", forwardAbort, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    requestController.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);
  try {
    return await task(requestController.signal);
  } catch (error) {
    if (explicitlyCancelledRequests.has(controller)) throw new StoryCancelledError("Story creation cancelled.");
    if (timedOut) throw new StoryRequestTimeoutError("StoryGen took too long this time. Please try again.");
    if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new StoryCancelledError("Story creation cancelled.");
    if (error instanceof StoryConnectionError || error instanceof StoryRequestTimeoutError) throw error;
    throw new StoryConnectionError("StoryGen lost the connection for a moment. Please try again.");
  } finally {
    window.clearTimeout(timeout);
    controller.signal.removeEventListener("abort", forwardAbort);
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number, controller = new AbortController()) {
  return withRequestTimeout(
    (signal) => fetch(input, { ...init, signal }),
    timeoutMs,
    controller,
  );
}

async function fetchStoryPlanWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  controller: AbortController,
) {
  return withRequestTimeout(async (signal) => {
    const response = await fetch(input, { ...init, signal });
    try {
      const result = await response.json() as GeneratedStoryResponse | StoryPlanJobResponse | { error?: string };
      return { response, result };
    } catch {
      throw new StoryConnectionError("StoryGen received an incomplete update. Please try again.");
    }
  }, timeoutMs, controller);
}

function waitForStoryPoll(delayMs: number, controller: AbortController) {
  return new Promise<void>((resolve, reject) => {
    if (controller.signal.aborted) {
      reject(new StoryCancelledError("Story creation cancelled."));
      return;
    }
    const timeout = window.setTimeout(() => {
      controller.signal.removeEventListener("abort", stopWaiting);
      resolve();
    }, delayMs);
    const stopWaiting = () => {
      window.clearTimeout(timeout);
      reject(new StoryCancelledError("Story creation cancelled."));
    };
    controller.signal.addEventListener("abort", stopWaiting, { once: true });
  });
}

function isStoryPlanJobResponse(value: unknown): value is StoryPlanJobResponse {
  if (!value || typeof value !== "object") return false;
  const job = value as Partial<StoryPlanJobResponse>;
  return (job.status === "queued" || job.status === "in_progress")
    && typeof job.jobToken === "string"
    && job.jobToken.length > 0;
}

function isGeneratedStoryResponse(value: unknown): value is GeneratedStoryResponse {
  if (!value || typeof value !== "object") return false;
  const story = value as Partial<GeneratedStoryResponse>;
  return typeof story.title === "string"
    && story.title.trim().length > 0
    && typeof story.creationName === "string"
    && typeof story.drawingSummary === "string"
    && typeof story.visualBible === "string"
    && typeof story.moral === "string"
    && story.moral.trim().length > 0
    && (story.readingLevel === "age-6" || story.readingLevel === "age-7-9")
    && typeof story.artToken === "string"
    && story.artToken.length > 0
    && Array.isArray(story.pages)
    && story.pages.length === 9
    && story.pages.every((page) => page
      && typeof page.title === "string"
      && page.title.trim().length > 0
      && typeof page.text === "string"
      && page.text.trim().length > 0
      && typeof page.imageAlt === "string"
      && page.imageAlt.trim().length > 0
      && typeof page.illustrationPrompt === "string"
      && page.illustrationPrompt.trim().length > 0
      && typeof page.sound === "string");
}

function getStoryPlanError(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const error = (value as { error?: unknown }).error;
  return typeof error === "string" ? error : "";
}

function getRetryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(30_000, Math.max(1_000, seconds * 1_000));
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.min(30_000, Math.max(1_000, retryAt - Date.now())) : undefined;
}

function cancelBackgroundStoryJob(jobToken: string) {
  if (!jobToken) return;
  void fetch("/api/generate-story-status", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobToken }),
    keepalive: true,
  }).catch(() => undefined);
}

function createStoryId() {
  return `story-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createStoryStartRequestId() {
  return `start_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getArtPassExpiry(artToken: string) {
  try {
    const encoded = artToken.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (Number.isFinite(payload?.expiresAt)) return Number(payload.expiresAt);
  } catch {
    // The signed token remains opaque; use the server's current two-hour window.
  }
  return Date.now() + FALLBACK_ART_PASS_LIFETIME_MS;
}

function formatArchiveDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
}

function formatAllowanceReset(timestamp: number | null) {
  if (!timestamp) return "later";
  const reset = new Date(timestamp);
  const now = new Date();
  const resetDay = Date.UTC(reset.getFullYear(), reset.getMonth(), reset.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOffset = Math.round((resetDay - today) / (24 * 60 * 60 * 1000));
  const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(reset);
  if (dayOffset === 0) return `at ${clock}`;
  if (dayOffset === 1) return `tomorrow at ${clock}`;
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(reset);
}

function isStoryAllowance(value: unknown): value is StoryAllowance {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoryAllowance>;
  const validBucket = (bucket: StoryAllowanceBucket | undefined) => Boolean(bucket
    && Number.isInteger(bucket.limit)
    && bucket.limit > 0
    && Number.isInteger(bucket.remaining)
    && bucket.remaining >= 0
    && bucket.remaining <= bucket.limit
    && (bucket.resetsAt === null || Number.isFinite(bucket.resetsAt)));
  return typeof candidate.availableNow === "boolean"
    && validBucket(candidate.daily)
    && validBucket(candidate.hourly);
}

export default function Home() {
  const [view, setView] = useState<"studio" | "making" | "book">("studio");
  const [page, setPage] = useState(0);
  const [drawingUrl, setDrawingUrl] = useState<string | null>(null);
  const [artDrawingUrl, setArtDrawingUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [drawingHint, setDrawingHint] = useState("");
  const [activeStory, setActiveStory] = useState<StoryPage[]>(sampleStory);
  const [activeStoryId, setActiveStoryId] = useState("");
  const [storyTitle, setStoryTitle] = useState("The Three-Wheel Thunderbolt");
  const [storyMoral, setStoryMoral] = useState(SAMPLE_MORAL);
  const [storyCoverImage, setStoryCoverImage] = useState<string | undefined>(undefined);
  const [creationName, setCreationName] = useState("");
  const [drawingSummary, setDrawingSummary] = useState("");
  const [artToken, setArtToken] = useState("");
  const [pageOneAnchorToken, setPageOneAnchorToken] = useState("");
  const [artExpiresAt, setArtExpiresAt] = useState(0);
  const [storyUsesDrawing, setStoryUsesDrawing] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [storyPlanStatus, setStoryPlanStatus] = useState("Starting the story");
  const [isDragging, setIsDragging] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [savedStory, setSavedStory] = useState<StoredStory | null>(null);
  const [archivedStories, setArchivedStories] = useState<ArchivedStorySummary[]>([]);
  const [archiveStatus, setArchiveStatus] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [openingStoryId, setOpeningStoryId] = useState<string | null>(null);
  const [removingStoryId, setRemovingStoryId] = useState<string | null>(null);
  const [activeStoryLocation, setActiveStoryLocation] = useState<StoryLocation>("sample");
  const [nightMode, setNightMode] = useState(false);
  const [recipeExpanded, setRecipeExpanded] = useState(false);
  const [recipePreferencesLoaded, setRecipePreferencesLoaded] = useState(false);
  const [surpriseWorld, setSurpriseWorld] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0].id);
  const [addBadGuy, setAddBadGuy] = useState(true);
  const [selectedBadGuy, setSelectedBadGuy] = useState(badGuys[0].id);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("age-6");
  const [storyScenario, setStoryScenario] = useState(scenarios[0].id);
  const [storyBadGuy, setStoryBadGuy] = useState<string | null>(badGuys[0].id);
  const [storyReadingLevel, setStoryReadingLevel] = useState<ReadingLevel>("age-6");
  const [storyInterests, setStoryInterests] = useState<string[]>([]);
  const [storyAllowance, setStoryAllowance] = useState<StoryAllowance | null>(null);
  const [storyAllowanceStatus, setStoryAllowanceStatus] = useState<StoryAllowanceStatus>("loading");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const confirmCancelButton = useRef<HTMLButtonElement>(null);
  const confirmDialog = useRef<HTMLElement>(null);
  const artRequests = useRef(new Set<number>());
  const artControllers = useRef(new Map<number, AbortController>());
  const storyPlanController = useRef<AbortController | null>(null);
  const storyPlanJobToken = useRef("");
  const storyStartRequest = useRef<{ fingerprint: string; id: string; resolvedScenario: string } | null>(null);
  const storyRun = useRef(0);
  const creatingStory = useRef(false);
  const activeStoryRef = useRef(activeStory);
  const pageOneAnchorTokenRef = useRef("");
  const speechRun = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  const storyPersistenceRun = useRef(0);
  const archiveOperationRun = useRef(0);
  const shelfOpenRun = useRef(0);
  const storyAllowanceController = useRef<AbortController | null>(null);

  const tonightScenario = scenarios.find((scenario) => scenario.id === selectedScenario) ?? scenarios[0];
  const tonightBadGuy = badGuys.find((badGuy) => badGuy.id === selectedBadGuy) ?? badGuys[0];
  const tonightExtras = interests.filter((interest) => selectedInterests.includes(interest.id));
  const tonightReadingLevel = readingLevels.find((level) => level.id === readingLevel) ?? readingLevels[0];
  const tonightRecipe = [
    surpriseWorld ? "Surprise world" : tonightScenario.title,
    addBadGuy ? tonightBadGuy.name : "No villain",
    tonightReadingLevel.label,
    ...tonightExtras.map((interest) => interest.label),
  ].join(" · ");
  const paintedPageCount = activeStory.filter((storyPage) => Boolean(storyPage.image)).length;
  const activeStoryIsArchived = activeStoryLocation === "archive"
    && archivedStories.some((story) => story.id === activeStoryId);
  const hasFamilyStories = Boolean(savedStory || archivedStories.length);
  const storyAllowanceBlocked = storyAllowanceStatus === "ready" && storyAllowance?.availableNow === false;
  const storyAllowanceCopy = storyAllowanceStatus === "loading"
    ? "Checking tonight’s story count…"
    : storyAllowanceStatus === "unavailable" || !storyAllowance
      ? "Story count unavailable. You can still try."
      : storyAllowance.daily.remaining <= 0
        ? `No story starts left in this 24-hour allowance · More ready ${formatAllowanceReset(storyAllowance.daily.resetsAt)}.`
        : storyAllowance.hourly.remaining <= 0
          ? `${storyAllowance.daily.remaining} story starts left in the 24-hour allowance · Next story ${formatAllowanceReset(storyAllowance.hourly.resetsAt)}.`
          : `${storyAllowance.daily.remaining} ${storyAllowance.daily.remaining === 1 ? "story start" : "story starts"} left in the family’s 24-hour allowance.`;
  const nightlyCtaCopy = !drawingUrl
    ? "Add a picture to begin"
    : storyAllowanceBlocked
      ? storyAllowance?.daily.remaining === 0 ? "Daily story allowance is resting" : `Next story ${formatAllowanceReset(storyAllowance?.hourly.resetsAt ?? null)}`
      : "Make tonight’s story";
  const confirmationCopy = confirmAction?.kind === "replace-draft"
    ? {
      title: "Start a new story?",
      message: `“${confirmAction.title}” is still in progress. It will stay safe unless the new story is completed and takes its place.`,
      confirmLabel: "Start a new story",
      destructive: false,
    }
    : confirmAction?.kind === "discard-draft"
      ? {
        title: "Discard this draft?",
        message: `“${confirmAction.title}” will be removed from this device. This cannot be undone.`,
        confirmLabel: "Discard draft",
        destructive: true,
      }
      : confirmAction?.kind === "remove-archive"
        ? {
          title: "Remove this story?",
          message: `“${confirmAction.story.title}” will leave this device and the story shelf. This cannot be undone.`,
          confirmLabel: "Remove story",
          destructive: true,
        }
        : null;

  const cancelArtRequests = useCallback(() => {
    storyRun.current += 1;
    for (const controller of artControllers.current.values()) cancelRequest(controller);
    artControllers.current.clear();
    artRequests.current.clear();
  }, []);

  const stopReading = useCallback(() => {
    speechRun.current += 1;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const refreshStoryAllowance = useCallback(async () => {
    storyAllowanceController.current?.abort();
    const controller = new AbortController();
    storyAllowanceController.current = controller;
    setStoryAllowanceStatus((current) => current === "ready" ? current : "loading");
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch("/api/story-allowance", {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const result = await response.json() as unknown;
      if (!response.ok || !isStoryAllowance(result)) throw new Error("Story allowance unavailable");
      if (storyAllowanceController.current !== controller) return;
      setStoryAllowance(result);
      setStoryAllowanceStatus("ready");
    } catch {
      if (storyAllowanceController.current !== controller) return;
      setStoryAllowanceStatus("unavailable");
    } finally {
      window.clearTimeout(timeout);
      if (storyAllowanceController.current === controller) storyAllowanceController.current = null;
    }
  }, []);

  const openSample = () => {
    cancelArtRequests();
    stopReading();
    setActiveStory(sampleStory);
    setActiveStoryId("");
    setStoryTitle("The Three-Wheel Thunderbolt");
    setStoryMoral(SAMPLE_MORAL);
    setStoryCoverImage(undefined);
    setStoryUsesDrawing(false);
    setActiveStoryLocation("sample");
    setArchiveStatus("");
    setCreationName("");
    setDrawingSummary("");
    setStoryInterests([]);
    setArtToken("");
    setPageOneAnchorToken("");
    pageOneAnchorTokenRef.current = "";
    setPage(0);
    setView("book");
  };

  const selectDrawing = async (file?: File) => {
    if (!file) return;
    cancelArtRequests();
    stopReading();
    setStoryUsesDrawing(false);
    setGenerationError("");
    try {
      const prepared = await prepareDrawing(file);
      setDrawingUrl(prepared.planningDataUrl);
      setArtDrawingUrl(prepared.artReferenceDataUrl);
      setFileName(file.name);
      setDrawingHint("");
      storyStartRequest.current = null;
    } catch (error) {
      setDrawingUrl(null);
      setArtDrawingUrl(null);
      setFileName("");
      storyStartRequest.current = null;
      setGenerationError(error instanceof Error ? error.message : "That picture could not be opened.");
    }
  };

  const handleDrawing = (event: ChangeEvent<HTMLInputElement>) => {
    void selectDrawing(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void selectDrawing(event.dataTransfer.files?.[0]);
  };

  const createStory = async () => {
    if (creatingStory.current) return;
    if (!drawingUrl || !artDrawingUrl) {
      setGenerationError("Add a picture first so it can become part of the story.");
      document.getElementById("drawing-upload")?.focus();
      return;
    }
    cancelArtRequests();
    stopReading();
    setStoryUsesDrawing(false);
    const requestFingerprint = JSON.stringify({
      drawingHint: drawingHint.trim(),
      worldMode: surpriseWorld ? "surprise" : "chosen",
      scenario: selectedScenario,
      badGuy: addBadGuy ? selectedBadGuy : null,
      interests: selectedInterests,
      readingLevel,
    });
    let pendingStartRequest = storyStartRequest.current;
    if (pendingStartRequest?.fingerprint !== requestFingerprint) {
      pendingStartRequest = {
        fingerprint: requestFingerprint,
        id: createStoryStartRequestId(),
        resolvedScenario: surpriseWorld ? pickSurpriseScenario() : selectedScenario,
      };
      storyStartRequest.current = pendingStartRequest;
    }
    const startRequestId = pendingStartRequest.id;
    const resolvedScenario = pendingStartRequest.resolvedScenario;
    creatingStory.current = true;
    const controller = new AbortController();
    storyPlanController.current = controller;
    storyPlanJobToken.current = "";
    setGenerationError("");
    setStoryPlanStatus("Starting the story");
    setView("making");
    try {
      const planningStartedAt = Date.now();
      const startedStory = await (async () => {
        try {
          return await fetchStoryPlanWithTimeout("/api/generate-story", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageDataUrl: drawingUrl,
              artReferenceDataUrl: artDrawingUrl,
              drawingHint: drawingHint.trim(),
              scenario: resolvedScenario,
              badGuy: addBadGuy ? selectedBadGuy : null,
              interests: selectedInterests,
              readingLevel,
              requestId: startRequestId,
            }),
          }, STORY_PLAN_REQUEST_TIMEOUT_MS, controller);
        } finally {
          void refreshStoryAllowance();
        }
      })();
      let response = startedStory.response;
      let planResult = startedStory.result;
      if (controller.signal.aborted || storyPlanController.current !== controller) {
        throw new StoryCancelledError("Story creation cancelled.");
      }
      if (!response.ok) throw new Error(getStoryPlanError(planResult) || "The story could not be made. Please try again.");

      let reconnects = 0;
      while (isStoryPlanJobResponse(planResult)) {
        if (storyStartRequest.current?.id === startRequestId) storyStartRequest.current = null;
        storyPlanJobToken.current = planResult.jobToken;
        setStoryPlanStatus(reconnects > 0
          ? "Reconnecting to the story engine"
          : "Writing and checking nine bedtime chapters");
        if (Date.now() - planningStartedAt >= STORY_PLAN_TIMEOUT_MS) {
          throw new StoryRequestTimeoutError("StoryGen is still working, but bedtime cannot wait forever. Please try again.");
        }

        const requestedDelay = Number(planResult.retryAfterMs);
        const pollDelay = Number.isFinite(requestedDelay)
          ? Math.min(5_000, Math.max(750, requestedDelay))
          : STORY_PLAN_POLL_INTERVAL_MS;
        await waitForStoryPoll(pollDelay, controller);

        try {
          const storyUpdate = await fetchStoryPlanWithTimeout("/api/generate-story-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobToken: storyPlanJobToken.current }),
          }, STORY_PLAN_REQUEST_TIMEOUT_MS, controller);
          response = storyUpdate.response;
          const nextPlanResult = storyUpdate.result;
          if (controller.signal.aborted || storyPlanController.current !== controller) {
            throw new StoryCancelledError("Story creation cancelled.");
          }
          const classifiedUpdate = classifyStoryPlanUpdate(planResult, response.status, nextPlanResult);
          if (classifiedUpdate.kind !== "accepted") {
            const statusError = getStoryPlanError(nextPlanResult) || "The story could not be finished. Please try again.";
            if (classifiedUpdate.kind === "retry") {
              planResult = classifiedUpdate.result;
              throw new StoryConnectionError(statusError, getRetryAfterMs(response));
            }
            throw new Error(statusError);
          }
          planResult = classifiedUpdate.result;
          reconnects = 0;
        } catch (error) {
          if (error instanceof StoryCancelledError) throw error;
          if (!(error instanceof StoryConnectionError || error instanceof StoryRequestTimeoutError)) throw error;
          reconnects += 1;
          if (Date.now() - planningStartedAt >= STORY_PLAN_TIMEOUT_MS) throw error;
          setStoryPlanStatus("Reconnecting to the story engine");
          const retryDelay = error instanceof StoryConnectionError && error.retryAfterMs
            ? error.retryAfterMs
            : Math.min(10_000, reconnects * 1_500);
          await waitForStoryPoll(retryDelay, controller);
        }
      }

      if (!isGeneratedStoryResponse(planResult)) {
        throw new Error(getStoryPlanError(planResult) || "The story came back incomplete. Please try again.");
      }
      if (storyStartRequest.current?.id === startRequestId) storyStartRequest.current = null;
      const result = planResult;
      const nextPages = result.pages.map((storyPage) => ({
        title: storyPage.title,
        text: storyPage.text,
        alt: storyPage.imageAlt,
        illustrationPrompt: storyPage.illustrationPrompt,
        illustrationStatus: "idle" as IllustrationStatus,
        sound: storyPage.sound || undefined,
      }));
      const nextStoryId = createStoryId();
      const nextExpiry = getArtPassExpiry(result.artToken);
      const initialRecord: StoredStory = {
        version: 1,
        id: nextStoryId,
        title: result.title,
        creationName: result.creationName,
        drawingSummary: result.drawingSummary,
        moral: result.moral,
        coverImage: undefined,
        drawingHint: drawingHint.trim(),
        drawingDataUrl: artDrawingUrl,
        artToken: result.artToken,
        pageOneAnchorToken: "",
        scenario: resolvedScenario,
        badGuy: addBadGuy ? selectedBadGuy : null,
        interests: selectedInterests,
        readingLevel: result.readingLevel,
        pages: nextPages,
        lastPage: 0,
        expiresAt: nextExpiry,
        updatedAt: Date.now(),
      };
      const persistenceRun = storyPersistenceRun.current + 1;
      storyPersistenceRun.current = persistenceRun;
      void saveStoredStory(initialRecord)
        .then(() => {
          if (storyPersistenceRun.current === persistenceRun) setSavedStory(initialRecord);
        })
        .catch(() => {
          if (storyPersistenceRun.current === persistenceRun) setSavedStory(null);
        });
      setActiveStory(nextPages);
      setActiveStoryId(nextStoryId);
      setStoryTitle(result.title);
      setStoryMoral(result.moral);
      setStoryCoverImage(undefined);
      setCreationName(result.creationName);
      setDrawingSummary(result.drawingSummary);
      setArtToken(result.artToken);
      setPageOneAnchorToken("");
      pageOneAnchorTokenRef.current = "";
      setArtExpiresAt(nextExpiry);
      setStoryUsesDrawing(true);
      setActiveStoryLocation("current");
      setStoryScenario(resolvedScenario);
      setStoryBadGuy(addBadGuy ? selectedBadGuy : null);
      setStoryReadingLevel(result.readingLevel);
      setStoryInterests(selectedInterests);
      setPage(0);
      setView("book");
    } catch (error) {
      if (storyPlanController.current && storyPlanController.current !== controller) return;
      if (!(error instanceof StoryCancelledError)) {
        cancelBackgroundStoryJob(storyPlanJobToken.current);
        setGenerationError(error instanceof Error ? error.message : "The story could not be made. Please try again.");
      }
      setView("studio");
      if (!(error instanceof StoryCancelledError)) {
        window.setTimeout(() => document.getElementById("studio-create")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      }
    } finally {
      if (storyPlanController.current === controller) {
        creatingStory.current = false;
        storyPlanController.current = null;
        storyPlanJobToken.current = "";
      }
    }
  };

  const cancelStoryPlanning = () => {
    const jobToken = storyPlanJobToken.current;
    if (storyPlanController.current) cancelRequest(storyPlanController.current);
    storyPlanController.current = null;
    storyPlanJobToken.current = "";
    creatingStory.current = false;
    setGenerationError("");
    setView("studio");
    cancelBackgroundStoryJob(jobToken);
  };

  const requestStoryCreation = () => {
    if (savedStory) {
      setConfirmAction({ kind: "replace-draft", title: savedStory.title });
      return;
    }
    void createStory();
  };

  const paintPage = useCallback(async (index: number, retry = false) => {
    const storyPage = activeStoryRef.current[index];
    const pageOneAnchorDataUrl = activeStoryRef.current[0]?.image;
    const anchorToken = pageOneAnchorTokenRef.current;
    if (!storyUsesDrawing || !artDrawingUrl || !artToken || artExpiresAt <= Date.now() || !storyPage?.illustrationPrompt || storyPage.image || storyPage.illustrationStatus === "loading" || (!retry && storyPage.illustrationStatus === "error") || artRequests.current.has(index)) return;
    if (index > 0 && (!pageOneAnchorDataUrl || !anchorToken)) return;
    if (artRequests.current.size >= PAGE_ART_CONCURRENCY) {
      if (retry) setActiveStory((pages) => pages.map((item, itemIndex) => itemIndex === index ? { ...item, illustrationStatus: "idle", illustrationError: undefined } : item));
      return;
    }

    const requestRun = storyRun.current;
    const controller = new AbortController();
    artRequests.current.add(index);
    artControllers.current.set(index, controller);
    setActiveStory((pages) => pages.map((item, itemIndex) => itemIndex === index
      ? { ...item, illustrationStatus: "loading", illustrationError: undefined }
      : item));

    try {
      const response = await fetchWithTimeout("/api/generate-page-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artToken,
          pageNumber: index + 1,
          drawingDataUrl: artDrawingUrl,
          ...(index > 0 ? { pageOneAnchorDataUrl, pageOneAnchorToken: anchorToken } : {}),
        }),
      }, PAGE_ART_TIMEOUT_MS, controller);
      const result = await response.json() as GeneratedPageImageResponse;
      if (!response.ok) {
        const broadLimit = result.limitReason === "page-client" || result.limitReason === "page-global";
        const retryAfterSeconds = Number(result.retryAfterSeconds ?? response.headers.get("Retry-After"));
        if (response.status === 429 && broadLimit && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
          const retryAt = Date.now() + (retryAfterSeconds * 1000);
          throw new Error(`StoryGen’s picture allowance is resting. Try again ${formatAllowanceReset(retryAt)}.`);
        }
        throw new Error(result.error || "This page could not be painted. Please try again.");
      }
      if (requestRun !== storyRun.current) return;
      if (index === 0) {
        if (!result.pageOneAnchorToken) throw new Error("The first page needs one more brushstroke before the book can continue.");
        pageOneAnchorTokenRef.current = result.pageOneAnchorToken;
        setPageOneAnchorToken(result.pageOneAnchorToken);
        void createCoverThumbnail(result.imageDataUrl)
          .then((coverImage) => {
            if (requestRun === storyRun.current) setStoryCoverImage(coverImage);
          })
          .catch(() => {
            if (requestRun === storyRun.current) setStoryCoverImage(result.imageDataUrl);
          });
      }
      setActiveStory((pages) => pages.map((item, itemIndex) => itemIndex === index
        ? { ...item, image: result.imageDataUrl, illustrationStatus: "ready", illustrationError: undefined }
        : item));
    } catch (error) {
      if (requestRun !== storyRun.current) return;
      if (error instanceof StoryCancelledError) return;
      setActiveStory((pages) => pages.map((item, itemIndex) => itemIndex === index
        ? { ...item, illustrationStatus: "error", illustrationError: error instanceof Error ? error.message : "This page could not be painted." }
        : item));
    } finally {
      if (artControllers.current.get(index) === controller) {
        artControllers.current.delete(index);
        artRequests.current.delete(index);
      }
    }
  }, [artDrawingUrl, artExpiresAt, artToken, storyUsesDrawing]);

  const turnPage = useCallback((direction: number) => {
    stopReading();
    setPage((current) => Math.max(0, Math.min(activeStoryRef.current.length - 1, current + direction)));
  }, [stopReading]);

  const goToPage = (index: number) => {
    stopReading();
    setPage(index);
  };

  const readAloud = () => {
    if (!("speechSynthesis" in window)) return;
    if (isSpeaking) {
      stopReading();
      return;
    }
    const run = speechRun.current + 1;
    speechRun.current = run;
    setIsSpeaking(true);
    const speakPage = (index: number) => {
      if (speechRun.current !== run) return;
      const storyPage = activeStoryRef.current[index];
      if (!storyPage) { setIsSpeaking(false); return; }
      setPage(index);
      const speech = new SpeechSynthesisUtterance(`${storyPage.title}. ${storyPage.text} ${storyPage.sound ?? ""}`);
      speech.rate = 0.9;
      speech.pitch = 1.08;
      speech.onend = () => {
        if (speechRun.current !== run) return;
        if (index + 1 < activeStoryRef.current.length) window.setTimeout(() => speakPage(index + 1), 250);
        else setIsSpeaking(false);
      };
      speech.onerror = () => {
        if (speechRun.current === run) setIsSpeaking(false);
      };
      window.speechSynthesis.speak(speech);
    };
    speakPage(page);
  };

  const upsertArchivedSummary = (summary: ArchivedStorySummary) => {
    setArchivedStories((stories) => [summary, ...stories.filter((story) => story.id !== summary.id)]
      .sort((left, right) => right.archivedAt - left.archivedAt));
  };

  const openStoredStory = (story: StoredStory, location: Exclude<StoryLocation, "sample">) => {
    cancelArtRequests();
    stopReading();
    storyStartRequest.current = null;
    const artPassActive = Boolean(story.artToken && story.drawingDataUrl && story.expiresAt > Date.now());
    const resumedPages = story.pages.map((storyPage) => {
      if (storyPage.image) return { ...storyPage, illustrationStatus: "ready" as IllustrationStatus, illustrationError: undefined };
      if (artPassActive) return storyPage.illustrationStatus === "loading"
        ? { ...storyPage, illustrationStatus: "idle" as IllustrationStatus }
        : storyPage;
      return {
        ...storyPage,
        illustrationStatus: "error" as IllustrationStatus,
        illustrationError: "This picture wasn’t finished before its art pass ended.",
      };
    });
    setActiveStory(resumedPages);
    setActiveStoryId(story.id);
    setActiveStoryLocation(location);
    setStoryTitle(story.title);
    setStoryMoral(story.moral || storyMoralFallback(resumedPages));
    setStoryCoverImage(story.coverImage);
    const coverRun = storyRun.current;
    if (story.pages[0]?.image) {
      void createCoverThumbnail(story.pages[0].image)
        .then((coverImage) => {
          if (coverRun === storyRun.current) setStoryCoverImage(coverImage);
        })
        .catch(() => undefined);
    }
    setCreationName(story.creationName);
    setDrawingSummary(story.drawingSummary);
    setDrawingHint(story.drawingHint);
    setDrawingUrl(story.drawingDataUrl || null);
    setArtDrawingUrl(story.drawingDataUrl || null);
    setFileName(location === "archive" ? "Saved on the story shelf" : "Saved on this device");
    setArtToken(artPassActive ? story.artToken : "");
    setPageOneAnchorToken(artPassActive ? story.pageOneAnchorToken : "");
    pageOneAnchorTokenRef.current = artPassActive ? story.pageOneAnchorToken : "";
    setArtExpiresAt(story.expiresAt);
    setStoryScenario(story.scenario);
    setStoryBadGuy(story.badGuy);
    const savedReadingLevel: ReadingLevel = story.readingLevel === "age-7-9" ? "age-7-9" : "age-6";
    setStoryReadingLevel(savedReadingLevel);
    const validInterestIds = new Set(interests.map((interest) => interest.id));
    const storedInterests = Array.isArray(story.interests) ? story.interests : [];
    const savedExtras = storedInterests.length <= MAX_STORY_EXTRAS
      ? storedInterests.filter((interest) => validInterestIds.has(interest))
      : [];
    setStoryInterests(savedExtras);
    setStoryUsesDrawing(true);
    setPage(Math.min(story.lastPage, resumedPages.length - 1));
    setGenerationError("");
    setArchiveStatus(location === "archive" ? "Opened from your story shelf." : "");
    setView("book");
  };

  const continueSavedStory = () => {
    if (savedStory) openStoredStory(savedStory, "current");
  };

  const openStoryFromShelf = async (summary: ArchivedStorySummary) => {
    if (openingStoryId || removingStoryId) return;
    const openRun = shelfOpenRun.current + 1;
    shelfOpenRun.current = openRun;
    setOpeningStoryId(summary.id);
    setArchiveStatus(`Opening “${summary.title}”…`);
    try {
      const story = await loadArchivedStory(summary.id);
      if (shelfOpenRun.current !== openRun) return;
      if (!story) {
        setArchivedStories((stories) => stories.filter((item) => item.id !== summary.id));
        setArchiveStatus("That saved story could not be opened on this device.");
        return;
      }
      openStoredStory(story, "archive");
    } finally {
      if (shelfOpenRun.current === openRun) setOpeningStoryId(null);
    }
  };

  const saveCurrentStoryToShelf = async () => {
    if (!storyUsesDrawing || !activeStoryId || activeStoryLocation !== "current" || archiveBusy) return;
    const record: StoredStory = {
      version: 1,
      id: activeStoryId,
      title: storyTitle,
      creationName,
      drawingSummary,
      moral: storyMoral,
      coverImage: storyCoverImage || activeStory[0]?.image,
      drawingHint,
      drawingDataUrl: artDrawingUrl || "",
      artToken,
      pageOneAnchorToken,
      scenario: storyScenario,
      badGuy: storyBadGuy,
      interests: storyInterests,
      readingLevel: storyReadingLevel,
      pages: activeStory,
      lastPage: page,
      expiresAt: artExpiresAt,
      updatedAt: Date.now(),
    };
    storyPersistenceRun.current += 1;
    const archiveRun = archiveOperationRun.current + 1;
    archiveOperationRun.current = archiveRun;
    setArchiveBusy(true);
    setArchiveStatus("Saving this story to your shelf…");
    setActiveStoryLocation("archive");
    try {
      const summary = await archiveStoredStory(record);
      if (archiveOperationRun.current !== archiveRun) return;
      setSavedStory(null);
      upsertArchivedSummary(summary);
      setArchiveStatus("Saved to your story shelf.");
      try { void navigator.storage?.persist?.().catch(() => undefined); } catch { /* Saving still works without persistent-storage permission. */ }
    } catch (error) {
      if (archiveOperationRun.current !== archiveRun) return;
      setActiveStoryLocation("current");
      setSavedStory(await loadStoredStory());
      setArchiveStatus(error instanceof Error ? error.message : "This story could not be saved. Remove an older story and try again.");
    } finally {
      if (archiveOperationRun.current === archiveRun) setArchiveBusy(false);
    }
  };

  const deleteStoryFromShelf = async (summary: ArchivedStorySummary) => {
    if (openingStoryId || removingStoryId || archiveBusy) return;
    shelfOpenRun.current += 1;
    setRemovingStoryId(summary.id);
    const previousStories = archivedStories;
    setArchivedStories((stories) => stories.filter((story) => story.id !== summary.id));
    setArchiveStatus(`Removing “${summary.title}”…`);
    if (activeStoryLocation === "archive" && activeStoryId === summary.id) {
      storyPersistenceRun.current += 1;
      cancelArtRequests();
      stopReading();
      setActiveStoryLocation("sample");
      setActiveStoryId("");
      setStoryUsesDrawing(false);
    }
    try {
      const removed = await removeArchivedStory(summary.id);
      if (removed) setArchiveStatus(`Removed “${summary.title}” from your story shelf.`);
      else {
        setArchivedStories(previousStories);
        setArchiveStatus("That story could not be removed. Please try again.");
      }
    } finally {
      setRemovingStoryId(null);
    }
  };

  const discardSavedStory = async () => {
    if (!savedStory) return;
    const storyId = savedStory.id;
    const persistenceRun = storyPersistenceRun.current + 1;
    storyPersistenceRun.current = persistenceRun;
    if (savedStory.id === activeStoryId && activeStoryLocation === "current") {
      cancelArtRequests();
      setStoryUsesDrawing(false);
      setActiveStoryLocation("sample");
      setActiveStoryId("");
      setArtToken("");
      setPageOneAnchorToken("");
      pageOneAnchorTokenRef.current = "";
    }
    setSavedStory(null);
    await clearStoredStory(storyId);
    const remainingStory = await loadStoredStory();
    if (storyPersistenceRun.current === persistenceRun) setSavedStory(remainingStory);
  };

  const confirmPendingAction = async () => {
    if (!confirmAction || confirmBusy) return;
    const action = confirmAction;
    setConfirmBusy(true);
    try {
      if (action.kind === "replace-draft") {
        setConfirmAction(null);
        await createStory();
      } else if (action.kind === "discard-draft") {
        await discardSavedStory();
        setConfirmAction(null);
      } else {
        await deleteStoryFromShelf(action.story);
        setConfirmAction(null);
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const surpriseMe = () => setSurpriseWorld(true);

  const toggleInterest = (interestId: string) => {
    setSelectedInterests((current) => {
      if (current.includes(interestId)) return current.filter((item) => item !== interestId);
      if (current.length >= MAX_STORY_EXTRAS) return current;
      return [...current, interestId];
    });
  };

  const toggleNightMode = () => {
    setNightMode((current) => {
      const next = !current;
      document.documentElement.classList.toggle("storygen-night", next);
      try { window.localStorage.setItem(NIGHT_MODE_KEY, next ? "night" : "day"); } catch { /* Preference remains active for this visit. */ }
      return next;
    });
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.changedTouches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    turnPage(deltaX < 0 ? 1 : -1);
  };

  useEffect(() => { activeStoryRef.current = activeStory; }, [activeStory]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshStoryAllowance();
    };
    void refreshStoryAllowance();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      storyAllowanceController.current?.abort();
      storyAllowanceController.current = null;
    };
  }, [refreshStoryAllowance]);

  useEffect(() => {
    if (storyAllowanceStatus !== "ready" || !storyAllowance) return;
    const nextReset = [storyAllowance.hourly.resetsAt, storyAllowance.daily.resetsAt]
      .filter((timestamp): timestamp is number => typeof timestamp === "number" && timestamp > Date.now())
      .sort((left, right) => left - right)[0];
    if (!nextReset) return;
    const timer = window.setTimeout(() => void refreshStoryAllowance(), Math.max(1_000, nextReset - Date.now() + 1_000));
    return () => window.clearTimeout(timer);
  }, [refreshStoryAllowance, storyAllowance, storyAllowanceStatus]);

  useEffect(() => {
    let disposed = false;
    void Promise.all([loadStoredStory(), listArchivedStorySummaries()]).then(([story, summaries]) => {
      if (disposed) return;
      setSavedStory(story);
      setArchivedStories(summaries);
      setLibraryLoaded(true);
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let recipe = DEFAULT_RECIPE;
    try {
      const storedRecipe = window.localStorage.getItem(RECIPE_PREFERENCES_KEY);
      if (storedRecipe) recipe = normalizeRecipePreferences(JSON.parse(storedRecipe));
    } catch { /* Tonight's warm defaults remain available. */ }
    setSurpriseWorld(recipe.worldMode === "surprise");
    setSelectedScenario(recipe.scenario);
    setAddBadGuy(recipe.addBadGuy);
    setSelectedBadGuy(recipe.badGuy);
    setSelectedInterests(recipe.interests);
    setReadingLevel(recipe.readingLevel);
    setRecipePreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!recipePreferencesLoaded) return;
    const recipe: RecipePreferences = {
      version: 1,
      worldMode: surpriseWorld ? "surprise" : "chosen",
      scenario: selectedScenario,
      addBadGuy,
      badGuy: selectedBadGuy,
      interests: selectedInterests,
      readingLevel,
    };
    try { window.localStorage.setItem(RECIPE_PREFERENCES_KEY, JSON.stringify(recipe)); } catch { /* The recipe remains active for this visit. */ }
  }, [addBadGuy, readingLevel, recipePreferencesLoaded, selectedBadGuy, selectedInterests, selectedScenario, surpriseWorld]);

  useEffect(() => {
    if (!confirmAction) return;
    const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keepFocusInDialog = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirmBusy) {
        event.preventDefault();
        setConfirmAction(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = confirmDialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInDialog);
    window.setTimeout(() => confirmCancelButton.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", keepFocusInDialog);
      document.body.style.overflow = priorOverflow;
      priorFocus?.focus();
    };
  }, [confirmAction, confirmBusy]);

  useEffect(() => {
    if (!storyUsesDrawing || activeStoryLocation === "sample" || !artExpiresAt) return;
    const finishArtPass = () => {
      cancelArtRequests();
      setActiveStory((pages) => pages.map((storyPage) => storyPage.image ? storyPage : {
        ...storyPage,
        illustrationStatus: "error",
        illustrationError: "This picture wasn’t finished before its art pass ended.",
      }));
      setDrawingUrl(null);
      setArtDrawingUrl(null);
      setFileName("");
      setArtToken("");
      setPageOneAnchorToken("");
      pageOneAnchorTokenRef.current = "";
      setArchiveStatus("The art pass has finished. Your story text and completed pictures are still here.");
    };
    const remaining = artExpiresAt - Date.now();
    if (remaining <= 0) {
      finishArtPass();
      return;
    }
    const timer = window.setTimeout(finishArtPass, remaining);
    return () => window.clearTimeout(timer);
  }, [activeStoryLocation, artExpiresAt, cancelArtRequests, storyUsesDrawing]);

  useEffect(() => {
    if (!savedStory) return;
    const clearExpiredStory = (storyId: string) => {
      const persistenceRun = storyPersistenceRun.current + 1;
      storyPersistenceRun.current = persistenceRun;
      setSavedStory(null);
      void clearStoredStory(storyId)
        .then(() => loadStoredStory())
        .then((remainingStory) => {
          if (storyPersistenceRun.current === persistenceRun) setSavedStory(remainingStory);
        });
    };
    const remaining = savedStory.expiresAt - Date.now();
    if (remaining <= 0) {
      clearExpiredStory(savedStory.id);
      return;
    }
    const timer = window.setTimeout(() => clearExpiredStory(savedStory.id), remaining);
    return () => window.clearTimeout(timer);
  }, [savedStory]);

  useEffect(() => {
    let nextNightMode = new Date().getHours() >= 18;
    try {
      const storedPreference = window.localStorage.getItem(NIGHT_MODE_KEY);
      nextNightMode = storedPreference ? storedPreference === "night" : nextNightMode;
    } catch { /* The local bedtime default still applies. */ }
    document.documentElement.classList.toggle("storygen-night", nextNightMode);
    setNightMode(nextNightMode);
  }, []);

  useEffect(() => {
    if (!archiveStatus) return;
    const timer = window.setTimeout(() => setArchiveStatus(""), 5_000);
    return () => window.clearTimeout(timer);
  }, [archiveStatus]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (view !== "book") return;
      if (event.key === "ArrowRight") turnPage(1);
      if (event.key === "ArrowLeft") turnPage(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [turnPage, view]);

  useEffect(() => {
    if (!storyUsesDrawing || !artToken || !artDrawingUrl || artExpiresAt <= Date.now()) return;
    if (!activeStory[0]?.image) {
      if (activeStory[0]?.illustrationStatus === "idle") void paintPage(0);
      return;
    }
    if (!pageOneAnchorToken) return;
    const availableSlots = PAGE_ART_CONCURRENCY - artRequests.current.size;
    if (availableSlots <= 0) return;
    const candidates = activeStory
      .map((storyPage, index) => ({ storyPage, index }))
      .filter(({ storyPage, index }) => index > 0 && !storyPage.image && storyPage.illustrationStatus === "idle")
      .sort((left, right) => left.index === page ? -1 : right.index === page ? 1 : left.index - right.index);
    for (const candidate of candidates.slice(0, availableSlots)) void paintPage(candidate.index);
  }, [activeStory, artDrawingUrl, artExpiresAt, artToken, page, pageOneAnchorToken, paintPage, storyUsesDrawing]);

  useEffect(() => {
    if (!storyUsesDrawing || !activeStoryId || activeStoryLocation === "sample") return;
    if (activeStoryLocation === "current" && (!artDrawingUrl || !artToken || artExpiresAt <= Date.now())) return;
    const record: StoredStory = {
      version: 1,
      id: activeStoryId,
      title: storyTitle,
      creationName,
      drawingSummary,
      moral: storyMoral,
      coverImage: storyCoverImage || activeStory[0]?.image,
      drawingHint,
      drawingDataUrl: artDrawingUrl || "",
      artToken,
      pageOneAnchorToken,
      scenario: storyScenario,
      badGuy: storyBadGuy,
      interests: storyInterests,
      readingLevel: storyReadingLevel,
      pages: activeStory,
      lastPage: page,
      expiresAt: artExpiresAt,
      updatedAt: Date.now(),
    };
    const persistenceRun = storyPersistenceRun.current;
    const timer = window.setTimeout(() => {
      if (storyPersistenceRun.current !== persistenceRun) return;
      if (activeStoryLocation === "current") {
        void saveStoredStory(record)
          .then(() => {
            if (storyPersistenceRun.current === persistenceRun) setSavedStory(record);
          })
          .catch(() => undefined);
      } else {
        void saveArchivedStory(record)
          .then((summary) => {
            if (storyPersistenceRun.current !== persistenceRun) return;
            setArchivedStories((stories) => [summary, ...stories.filter((story) => story.id !== summary.id)]
              .sort((left, right) => right.archivedAt - left.archivedAt));
          })
          .catch(() => undefined);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeStory, activeStoryId, activeStoryLocation, artDrawingUrl, artExpiresAt, artToken, creationName, drawingHint, drawingSummary, page, pageOneAnchorToken, storyBadGuy, storyCoverImage, storyInterests, storyMoral, storyReadingLevel, storyScenario, storyTitle, storyUsesDrawing]);

  useEffect(() => {
    if (view !== "book") return;
    let active = true;
    let requestPending = false;
    const requestWakeLock = async () => {
      if (!active || document.visibilityState !== "visible" || wakeLock.current || requestPending) return;
      requestPending = true;
      try {
        const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
        if (wakeLockApi) {
          const nextLock = await wakeLockApi.request("screen");
          if (!active || document.visibilityState !== "visible" || wakeLock.current) await nextLock.release();
          else {
            wakeLock.current = nextLock;
            nextLock.addEventListener?.("release", () => {
              if (wakeLock.current !== nextLock) return;
              wakeLock.current = null;
              if (active && document.visibilityState === "visible") {
                window.setTimeout(() => void requestWakeLock(), 0);
              }
            }, { once: true });
          }
        }
      } catch {
        // Reading still works on browsers without Screen Wake Lock permission.
      } finally {
        requestPending = false;
      }
    };
    const onVisibilityChange = () => {
      if (!active) return;
      if (document.visibilityState === "hidden") {
        const currentLock = wakeLock.current;
        wakeLock.current = null;
        void currentLock?.release().catch(() => undefined);
      } else void requestWakeLock();
    };
    void requestWakeLock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const currentLock = wakeLock.current;
      wakeLock.current = null;
      void currentLock?.release().catch(() => undefined);
    };
  }, [view]);

  useEffect(() => {
    const abandonBackgroundStory = () => {
      const jobToken = storyPlanJobToken.current;
      if (storyPlanController.current) cancelRequest(storyPlanController.current);
      cancelBackgroundStoryJob(jobToken);
    };
    window.addEventListener("pagehide", abandonBackgroundStory);
    return () => window.removeEventListener("pagehide", abandonBackgroundStory);
  }, []);

  useEffect(() => () => {
    const jobToken = storyPlanJobToken.current;
    if (storyPlanController.current) cancelRequest(storyPlanController.current);
    cancelBackgroundStoryJob(jobToken);
    cancelArtRequests();
    stopReading();
  }, [cancelArtRequests, stopReading]);

  if (view === "making") return (
    <main className={`making-screen ${nightMode ? "night-mode" : ""}`} aria-live="polite">
      <div className="making-card">
        <div className="magic-paper">
          {drawingUrl ? <img src={drawingUrl} alt="Your uploaded drawing" /> : null}
          <span className="magic-spark spark-one"><AppIcon icon={Sparkles} /></span><span className="magic-spark spark-two"><AppIcon icon={Sparkles} /></span><span className="magic-spark spark-three"><AppIcon icon={Sparkles} /></span>
        </div>
        <p className="eyebrow">Planning the storybook</p>
        <h1>Your creation is waking up…</h1>
        <div className="making-progress" aria-label="Story creation progress">
          <div className="done"><span><AppIcon icon={Check} /></span><strong>Your picture is prepared</strong></div>
          <div className="active"><span aria-hidden="true">2</span><strong>{storyPlanStatus}</strong></div>
          <div><span aria-hidden="true">3</span><strong>Fresh pictures begin as soon as the story opens</strong></div>
        </div>
        <p className="making-note">StoryGen keeps checking in while OpenAI writes, so a long story no longer depends on one long browser connection.</p>
        <button className="cancel-making" onClick={cancelStoryPlanning}><AppIcon icon={ArrowLeft} /> Back to the studio</button>
      </div>
    </main>
  );

  if (view === "book") {
    const current = activeStory[page];
    const isLast = page === activeStory.length - 1;
    return (
      <main className={`reader-shell ${nightMode ? "night-mode" : ""}`}>
        <header className="reader-header">
          <button className="mini-brand" onClick={() => { stopReading(); setView("studio"); }} aria-label="Back to StoryGen studio"><span className="brand-squiggle">S</span><span>StoryGen</span></button>
          <div className="reader-title"><span>{storyUsesDrawing ? `${paintedPageCount} of 9 pictures ready` : "5–7 minute sample story"}</span><strong>{storyTitle}</strong></div>
          <div className="reader-header-actions">{storyUsesDrawing ? <button className={`shelf-save-button ${activeStoryIsArchived ? "saved" : ""}`} onClick={() => void saveCurrentStoryToShelf()} disabled={activeStoryIsArchived || archiveBusy} aria-label={activeStoryIsArchived ? `“${storyTitle}” is saved to the story shelf` : `Save “${storyTitle}” to the story shelf`}><AppIcon icon={activeStoryIsArchived ? CircleCheck : Bookmark} /><b>{activeStoryIsArchived ? "Saved" : archiveBusy ? "Saving…" : "Save story"}</b></button> : null}<button className="night-toggle" onClick={toggleNightMode} aria-pressed={nightMode} aria-label={nightMode ? "Use day mode" : "Use night mode"}><AppIcon icon={nightMode ? Sun : Moon} />{nightMode ? "Day" : "Night"}</button><button className={`listen-button ${isSpeaking ? "is-speaking" : ""}`} onClick={readAloud} aria-pressed={isSpeaking} aria-label={isSpeaking ? "Stop reading" : "Read from here"}><span><AppIcon icon={isSpeaking ? Square : Play} /></span><b className="listen-label">{isSpeaking ? "Stop reading" : "Read from here"}</b></button></div>
        </header>
        {archiveStatus ? <p className="archive-reader-status" role="status" aria-live="polite">{archiveStatus}</p> : null}
        <section className="book-stage" aria-live="polite">
          <article className="book" key={page} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {storyUsesDrawing ? <div className={`picture-page generated-picture picture-${(page % 4) + 1}`}>
              {current.image ? <img className="fresh-page-art" src={current.image} alt={current.alt} /> : current.illustrationStatus === "error" ? <div className="illustration-error" role="alert">
                <AppIcon icon={Palette} />
                <strong>Page {page + 1} needs another brushstroke</strong>
                <p>{current.illustrationError}</p>
                {artToken && artDrawingUrl && artExpiresAt > Date.now() ? <button className="secondary-button" onClick={() => void paintPage(page, true)}>Paint this page again</button> : null}
              </div> : <div className="illustration-loading" aria-live="polite">
                <div className="paint-ingredients" aria-hidden="true"><span className="paint-child">S</span><b>+</b><img src={(artDrawingUrl || drawingUrl) ?? undefined} alt="" /></div>
                <span className="paint-orbit"><AppIcon icon={Sparkles} /></span>
                <strong>{current.illustrationStatus === "loading" ? `Painting a fresh page ${page + 1}…` : `Page ${page + 1} is in the paint queue…`}</strong>
                <p>{page === 0 ? "The first picture sets the look for every scene that follows." : `Bringing the child and ${creationName || "tonight’s creation"}${storyBadGuy ? " and the bad guy" : ""} into a brand-new scene.`}</p>
              </div>}
            </div> : <div className="picture-page"><img src={current.image} alt={current.alt} /></div>}
            <div className="words-page">
              <div className="page-number">{page + 1}</div>
              <p className="eyebrow">Chapter {page + 1}</p><h1>{current.title}</h1><p className="story-copy">{current.text}</p>
              {current.sound ? <div className="sound-word" aria-label={current.sound}>{current.sound}</div> : null}
              {isLast ? <section className={`story-finish ${current.image ? "art-ready" : ""}`} aria-label="Story finished"><AppIcon icon={Sparkles} className="finish-spark" /><h2>The End</h2><p>{storyMoral || SAMPLE_MORAL}</p><div className="last-page-actions">{storyUsesDrawing ? <button className="primary-button compact" onClick={() => void saveCurrentStoryToShelf()} disabled={activeStoryIsArchived || archiveBusy}><AppIcon icon={activeStoryIsArchived ? CircleCheck : Save} />{activeStoryIsArchived ? "Saved to shelf" : archiveBusy ? "Saving…" : "Save to shelf"}</button> : null}<button className="secondary-button" onClick={() => goToPage(0)}><AppIcon icon={RefreshCw} />Read again</button><button className="text-button" onClick={() => { stopReading(); setView("studio"); window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0); }}><AppIcon icon={Moon} />Good night</button></div></section> : null}
              <span className="page-doodle"><AppIcon icon={page === 4 ? WavesHorizontal : Sparkles} /></span>
            </div>
          </article>
        </section>
        <nav className="reader-controls" aria-label="Story pages">
          <button className="turn-button" onClick={() => turnPage(-1)} disabled={page === 0} aria-label="Previous page"><AppIcon icon={ChevronLeft} /></button>
          <div className="page-dots">{activeStory.map((storyPage, index) => <button key={`${index}-${storyPage.title}`} className={index === page ? "active" : ""} onClick={() => goToPage(index)} aria-label={`Go to page ${index + 1}: ${storyPage.title}`} aria-current={index === page ? "page" : undefined}><span aria-hidden="true" /></button>)}</div>
          <span className="page-count">{page + 1} / {activeStory.length}</span>
          <button className="turn-button next" onClick={() => turnPage(1)} disabled={isLast} aria-label="Next page"><AppIcon icon={ChevronRight} /></button>
        </nav>
      </main>
    );
  }

  return (
    <main className={`studio-shell ${nightMode ? "night-mode" : ""}`}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="StoryGen home"><span className="brand-squiggle">S</span><span className="brand-words"><strong>StoryGen</strong></span></a>
        <div className="site-header-actions"><button className="night-toggle" onClick={toggleNightMode} aria-pressed={nightMode} aria-label={nightMode ? "Use day mode" : "Use night mode"}><AppIcon icon={nightMode ? Sun : Moon} /><span>{nightMode ? "Day" : "Night"}</span></button><a className="shelf-link" href="#story-shelf" aria-label={`Open story shelf, ${archivedStories.length} saved`}><AppIcon icon={Library} /><b>Story shelf</b>{archivedStories.length > 0 ? <em>{archivedStories.length}</em> : null}</a></div>
      </header>
      {savedStory ? <section className="continue-card" aria-labelledby="continue-title">
        <img src={savedStory.pages.find((storyPage) => storyPage.image)?.image || savedStory.drawingDataUrl} alt="Preview of the story saved on this device" />
        <div><p className="eyebrow">Waiting on the desk</p><h2 id="continue-title">Continue “{savedStory.title}”</h2><p>Page {savedStory.lastPage + 1} of 9 · {savedStory.pages.filter((storyPage) => storyPage.image).length} pictures ready</p></div>
        <div className="continue-actions"><button className="primary-button compact" onClick={continueSavedStory}>Continue reading <AppIcon icon={ArrowRight} /></button><button className="text-button clear-story" onClick={() => setConfirmAction({ kind: "discard-draft", title: savedStory.title })}><Trash2 className="app-icon" aria-hidden="true" focusable="false" strokeWidth={1.9} />Discard draft</button></div>
      </section> : null}
      {archiveStatus ? <p className="story-shelf-status studio-archive-status" role="status" aria-live="polite">{archiveStatus}</p> : null}
      <section className="studio-workbench" id="top" aria-labelledby="upload-title">
        <h1 id="upload-title">What did your child make tonight?</h1>
        <section className="upload-paper">
          <span className="tape tape-left" aria-hidden="true" /><span className="tape tape-right" aria-hidden="true" />
          <label className={`drop-zone ${drawingUrl ? "has-drawing" : ""} ${isDragging ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
            <input ref={fileInput} className="drop-input" id="drawing-upload" type="file" accept="image/*" aria-label={drawingUrl ? "Choose a different picture" : "Snap his drawing or build"} onChange={handleDrawing} />
            {drawingUrl ? <><img src={drawingUrl} alt="Preview of the uploaded creation" /><span className="upload-success"><AppIcon icon={CircleCheck} />Picture added</span><span className="change-photo"><AppIcon icon={RefreshCw} />Choose another</span></> : <><span className="camera-bubble"><AppIcon icon={Camera} /></span><strong>Snap their drawing or build.</strong><span>Take a photo or choose one from this device.</span><span className="upload-button-look"><AppIcon icon={ImageUp} />Choose a picture</span><small>JPG, PNG or WebP. You can also drop it here.</small></>}
          </label>
          {fileName ? <p className="file-note">Ready: {fileName}</p> : null}
          {drawingUrl ? <div className="drawing-hint-field">
            <label htmlFor="drawing-hint">What is it? <span>Optional, but useful for names</span></label>
            <input id="drawing-hint" value={drawingHint} maxLength={90} onChange={(event) => setDrawingHint(event.target.value)} placeholder="A footballer, or a red brick race car" autoComplete="off" />
            <small>StoryGen will use your spelling instead of guessing.</small>
          </div> : null}
          {generationError && !drawingUrl ? <p className="form-error" role="alert">{generationError}</p> : null}
        </section>

        <section className="recipe-card" aria-labelledby="recipe-title">
          <div className="recipe-row">
            <span className="recipe-icon"><AppIcon icon={surpriseWorld ? Dice5 : tonightScenario.icon} /></span>
            <p aria-live="polite" aria-atomic="true"><small id="recipe-title">Tonight’s recipe</small><strong>{tonightRecipe}</strong></p>
            <button className="recipe-change" onClick={() => setRecipeExpanded((expanded) => !expanded)} aria-expanded={recipeExpanded} aria-controls="recipe-choices">Change <AppIcon icon={recipeExpanded ? ChevronUp : ChevronDown} /></button>
          </div>
          <div className="recipe-sheet" id="recipe-choices" hidden={!recipeExpanded}>
            <div className="recipe-sheet-heading"><div><p className="eyebrow">Tonight’s recipe</p><h2>Change the adventure</h2></div><button className="icon-button" onClick={() => setRecipeExpanded(false)} aria-label="Close story choices"><AppIcon icon={X} /></button></div>
            <section className="recipe-section" aria-labelledby="world-title"><div className="recipe-section-heading"><div><h3 id="world-title">World</h3><p>Choose one, or keep the surprise.</p></div><button className={`surprise-button ${surpriseWorld ? "selected" : ""}`} onClick={surpriseMe} aria-pressed={surpriseWorld}><AppIcon icon={Dice5} />Surprise world</button></div>
              <div className="scenario-grid" role="group" aria-label="Choose a story world">{scenarios.map((scenario) => <button key={scenario.id} className={`scenario-card ${!surpriseWorld && selectedScenario === scenario.id ? "selected" : ""}`} onClick={() => { setSurpriseWorld(false); setSelectedScenario(scenario.id); }} aria-pressed={!surpriseWorld && selectedScenario === scenario.id}><span className="scenario-icon"><AppIcon icon={scenario.icon} /></span><strong>{scenario.title}</strong><small>{scenario.hook}</small>{!surpriseWorld && selectedScenario === scenario.id ? <span className="scenario-check"><AppIcon icon={Check} /></span> : null}</button>)}</div>
            </section>
            <section className="recipe-section" aria-labelledby="extras-title"><div className="recipe-section-heading"><div><h3 id="extras-title">Extras</h3><p id="story-extras-help">Add up to two. The uploaded creation still leads the story.</p></div><span id="story-extras-count" className="selection-count" aria-live="polite">{selectedInterests.length} of {MAX_STORY_EXTRAS}</span></div>
              <div className="interest-chips" role="group" aria-label="Choose up to two optional story extras">{interests.map((interest) => {
                const selected = selectedInterests.includes(interest.id);
                const disabled = !selected && selectedInterests.length >= MAX_STORY_EXTRAS;
                return <button key={interest.id} className={selected ? "selected" : ""} onClick={() => toggleInterest(interest.id)} aria-pressed={selected} aria-describedby="story-extras-help story-extras-count" disabled={disabled}><AppIcon icon={interest.icon} />{interest.label}<span>{selected ? <AppIcon icon={Check} /> : <AppIcon icon={Plus} />}</span></button>;
              })}</div>
            </section>
            <fieldset className="reading-level-picker"><legend>Reading level</legend><p id="reading-level-help">The main character stays six. The language and detail can grow.</p><div className="reading-level-options" aria-describedby="reading-level-help">{readingLevels.map((level) => {
              const selected = readingLevel === level.id;
              return <label key={level.id} className={`reading-level-option ${selected ? "selected" : ""}`}><input type="radio" name="reading-level" value={level.id} checked={selected} onChange={() => setReadingLevel(level.id)} /><span className="reading-level-option-copy"><strong>{level.label}</strong><small>{level.description}</small></span><span className="reading-level-check">{selected ? <AppIcon icon={Check} /> : null}</span></label>;
            })}</div></fieldset>
            <section className="villain-builder" aria-labelledby="villain-title"><div className="villain-toggle-copy"><span className="villain-step"><AppIcon icon={Ghost} /></span><div><h3 id="villain-title">Add a bad guy?</h3><p>Spooky but child-safe. The child and their creation triumph in the end.</p></div></div><button className={`toggle ${addBadGuy ? "on" : ""}`} onClick={() => setAddBadGuy((current) => !current)} role="switch" aria-checked={addBadGuy}><span />{addBadGuy ? "Villain on" : "No villain"}</button>{addBadGuy ? <div className="bad-guy-options" role="group" aria-label="Choose a bad guy">{badGuys.map((badGuy) => <button key={badGuy.id} className={selectedBadGuy === badGuy.id ? "selected" : ""} onClick={() => setSelectedBadGuy(badGuy.id)} aria-pressed={selectedBadGuy === badGuy.id}><AppIcon icon={badGuy.icon} /><span><strong>{badGuy.name}</strong><small>{badGuy.description}</small></span>{selectedBadGuy === badGuy.id ? <AppIcon icon={Check} className="option-check" /> : null}</button>)}</div> : <p className="no-villain-note"><AppIcon icon={ShieldCheck} />Tonight’s story will use a challenge without a villain.</p>}</section>
            <div className="recipe-sheet-actions"><button className="secondary-button" onClick={() => setRecipeExpanded(false)}>Done</button>{drawingUrl ? <button className="primary-button compact" onClick={() => { setRecipeExpanded(false); requestStoryCreation(); }} disabled={storyAllowanceBlocked} aria-describedby="story-allowance-status"><AppIcon icon={Sparkles} />{nightlyCtaCopy}</button> : null}</div>
          </div>
        </section>

        {generationError && drawingUrl ? <p className="generation-error" role="alert"><b>The story paused:</b> {generationError}</p> : null}
        <div className="story-start-dock" id="studio-create"><button className="primary-button nightly-cta" onClick={requestStoryCreation} disabled={!drawingUrl || storyAllowanceBlocked} aria-describedby="story-allowance-status"><AppIcon icon={Sparkles} />{nightlyCtaCopy}</button><p id="story-allowance-status" className={`story-allowance ${storyAllowanceStatus === "ready" ? storyAllowanceBlocked ? "blocked" : "available" : ""}`} role="status" aria-live="polite" aria-atomic="true" aria-busy={storyAllowanceStatus === "loading"} title="A story start is counted when StoryGen begins writing, even if the story later pauses."><AppIcon icon={BookOpen} /><span>{storyAllowanceCopy}</span></p></div>
        <details className="privacy-note"><summary>How tonight’s picture is used</summary><p>Your picture and StoryGen’s private character references are sent to OpenAI to make the story and artwork. OpenAI temporarily retains the background story request and response for roughly ten minutes. Stories you save stay in this browser on this device. StoryGen keeps only short-lived anonymous request counters on its server.</p></details>
      </section>
      <section className="story-shelf" id="story-shelf" aria-labelledby="story-shelf-title">
        <div className="story-shelf-heading"><div><p className="eyebrow">Saved on this device</p><h2 id="story-shelf-title">The story shelf</h2><p>Favorite adventures wait here for another bedtime.</p></div><span>{archivedStories.length} of {MAX_ARCHIVED_STORIES}</span></div>
        {archivedStories.length > 0 ? <div className="story-shelf-grid">{archivedStories.map((story) => {
          const shelfReadingLevel = story.readingLevel === "age-7-9" ? "Ages 7–9" : "Age 6";
          const isOpening = openingStoryId === story.id;
          const isRemoving = removingStoryId === story.id;
          const shelfActionsBusy = Boolean(openingStoryId || removingStoryId || archiveBusy);
          return <article className="story-shelf-card" key={story.id} aria-busy={isOpening || isRemoving}>
            <figure className="story-shelf-book">{story.coverImage ? <img src={story.coverImage} alt="" /> : <div className="cover-drying"><AppIcon icon={Palette} /><span>Cover still drying</span></div>}<figcaption>{story.title}</figcaption></figure>
            <div className="story-shelf-copy"><p className="eyebrow">{shelfReadingLevel} · {story.pictureCount} {story.pictureCount === 1 ? "picture" : "pictures"}</p><p>{story.creationName || "The uploaded creation"}<br />Saved {formatArchiveDate(story.archivedAt)}</p></div>
            <div className="story-shelf-actions"><button className="primary-button compact" onClick={() => void openStoryFromShelf(story)} disabled={shelfActionsBusy}><AppIcon icon={BookOpen} />{isOpening ? "Opening…" : "Read story"}</button><button className="text-button" onClick={() => setConfirmAction({ kind: "remove-archive", story })} disabled={shelfActionsBusy}><AppIcon icon={Trash2} />{isRemoving ? "Removing…" : "Remove"}</button></div>
          </article>;
        })}</div> : <div className="story-shelf-empty"><span><AppIcon icon={Library} /></span><div><h3>The shelf is ready</h3><p>Save a finished story and its real cover will appear here.</p></div></div>}
      </section>
      {libraryLoaded ? hasFamilyStories ? <section className="sample-link-row"><button className="sample-link" onClick={openSample}><AppIcon icon={BookOpen} />Read the sample</button></section> : <section className="sample-band" aria-labelledby="sample-title"><img src="/story/page-1-v2.webp" alt="" /><div className="sample-copy"><p className="eyebrow">A story already on the desk</p><h2 id="sample-title">The Three-Wheel Thunderbolt</h2><p>A clever car, a shadowy brick thief, and one steady breath.</p><button className="secondary-button" onClick={openSample}><AppIcon icon={BookOpen} />Read the sample</button></div></section> : null}
      <footer><span>StoryGen · A bedtime story desk</span><span>Made for big imaginations and growing feelings.</span></footer>
      {confirmationCopy ? <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !confirmBusy) setConfirmAction(null); }}><section ref={confirmDialog} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"><span className="dialog-icon"><AppIcon icon={confirmationCopy.destructive ? Trash2 : Sparkles} /></span><h2 id="confirm-title">{confirmationCopy.title}</h2><p id="confirm-message">{confirmationCopy.message}</p><div className="dialog-actions"><button ref={confirmCancelButton} className="secondary-button" onClick={() => setConfirmAction(null)} disabled={confirmBusy}>Keep it</button><button className={`primary-button compact ${confirmationCopy.destructive ? "danger" : ""}`} onClick={() => void confirmPendingAction()} disabled={confirmBusy}>{confirmBusy ? "One moment…" : confirmationCopy.confirmLabel}</button></div></section></div> : null}
    </main>
  );
}
