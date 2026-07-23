import { env } from "cloudflare:workers";
import { claimPageGeneration, type D1Like } from "../abuse-guard";
import { resolveStoryChildConfig } from "../../story-child.js";
import { createPageImageResponse } from "./page-image-generator.js";

const REFERENCE_PATHS = {
  child: "/story/sam-character-reference.webp",
  "brick-snatcher": "/story/brick-snatcher-reference.webp",
  "giggle-glitch": "/story/giggle-glitch-reference.webp",
  "gear-king": "/story/gear-king-reference.webp",
} as const;
const MAX_BUNDLED_REFERENCE_BYTES = 2_000_000;
const referenceCache = new Map<string, Promise<Blob>>();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "StoryGen only paints pages requested from this site." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 18_000_000) {
    return Response.json({ error: "Those reference pictures are too large for the page painter." }, { status: 413 });
  }
  const runtimeEnv = env as typeof env & {
    OPENAI_API_KEY?: string;
    ASSETS?: Fetcher;
    DB?: D1Like;
    STORY_CHILD_NAME?: string;
    STORY_CHILD_APPEARANCE?: string;
  };
  return createPageImageResponse(request, {
    apiKey: runtimeEnv.OPENAI_API_KEY,
    childConfig: resolveStoryChildConfig(runtimeEnv),
    loadCanonicalReferences: (badGuy: string | null) => loadCanonicalReferences(runtimeEnv.ASSETS, request.url, badGuy),
    claimGeneration: ({ artToken, pageNumber, tokenExpiresAt }: { artToken: string; pageNumber: number; tokenExpiresAt: number }) => claimPageGeneration({
      database: runtimeEnv.DB,
      request,
      secret: runtimeEnv.OPENAI_API_KEY,
      artToken,
      pageNumber,
      tokenExpiresAt,
    }),
  });
}

async function loadCanonicalReferences(assets: Fetcher | undefined, requestUrl: string, badGuy: string | null) {
  if (!assets) throw new Error("Static asset binding is unavailable");
  const villainPath = badGuy === null
    ? null
    : REFERENCE_PATHS[badGuy as Exclude<keyof typeof REFERENCE_PATHS, "child">];
  if (badGuy !== null && !villainPath) throw new Error("Unknown canonical villain reference");

  const [child, villain] = await Promise.all([
    loadBundledReference(assets, requestUrl, REFERENCE_PATHS.child),
    villainPath ? loadBundledReference(assets, requestUrl, villainPath) : Promise.resolve(undefined),
  ]);
  return { child, villain };
}

async function loadBundledReference(assets: Fetcher, requestUrl: string, path: string) {
  const existing = referenceCache.get(path);
  if (existing) return existing;

  const pending = (async () => {
    const response = await assets.fetch(new Request(new URL(path, requestUrl)));
    if (!response.ok) throw new Error(`Bundled reference ${path} returned ${response.status}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 100 || bytes.byteLength > MAX_BUNDLED_REFERENCE_BYTES) {
      throw new Error(`Bundled reference ${path} has an invalid size`);
    }
    return new Blob([bytes], { type: "image/webp" });
  })();
  referenceCache.set(path, pending);
  try {
    return await pending;
  } catch (error) {
    if (referenceCache.get(path) === pending) referenceCache.delete(path);
    throw error;
  }
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
