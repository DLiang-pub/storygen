import { env } from "cloudflare:workers";
import { claimStoryGeneration, type D1Like } from "../abuse-guard";
import { resolveStoryChildConfig } from "../../story-child.js";
import { createBackgroundStoryResponse } from "./background-story-generator.js";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "StoryGen only accepts stories started from this site." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 10_000_000) {
    return Response.json(
      { error: "Those picture copies are too large for StoryGen. Please choose a smaller photo." },
      { status: 413 },
    );
  }
  const runtimeEnv = env as typeof env & {
    OPENAI_API_KEY?: string;
    DB?: D1Like;
    STORY_CHILD_NAME?: string;
    STORY_CHILD_APPEARANCE?: string;
  };
  return createBackgroundStoryResponse(request, {
    apiKey: runtimeEnv.OPENAI_API_KEY,
    childConfig: resolveStoryChildConfig(runtimeEnv),
    claimGeneration: () => claimStoryGeneration({
      database: runtimeEnv.DB,
      request,
      secret: runtimeEnv.OPENAI_API_KEY,
    }),
  });
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
