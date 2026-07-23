import { env } from "cloudflare:workers";
import { resolveStoryChildConfig } from "../../story-child.js";
import {
  cancelStoryStatusResponse,
  createStoryStatusResponse,
} from "./story-status.js";

const MAX_JOB_REQUEST_BYTES = 20_000;

export async function POST(request: Request) {
  const rejected = rejectUntrustedRequest(request);
  if (rejected) return rejected;
  const runtimeEnv = env as typeof env & {
    OPENAI_API_KEY?: string;
    STORY_CHILD_NAME?: string;
    STORY_CHILD_APPEARANCE?: string;
  };
  return createStoryStatusResponse(request, {
    apiKey: runtimeEnv.OPENAI_API_KEY,
    childConfig: resolveStoryChildConfig(runtimeEnv),
  });
}

export async function DELETE(request: Request) {
  const rejected = rejectUntrustedRequest(request);
  if (rejected) return rejected;
  const runtimeEnv = env as typeof env & {
    OPENAI_API_KEY?: string;
    STORY_CHILD_NAME?: string;
    STORY_CHILD_APPEARANCE?: string;
  };
  return cancelStoryStatusResponse(request, {
    apiKey: runtimeEnv.OPENAI_API_KEY,
    childConfig: resolveStoryChildConfig(runtimeEnv),
  });
}

function rejectUntrustedRequest(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json(
      { error: "StoryGen only accepts story checks from this site." },
      { status: 403 },
    );
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_JOB_REQUEST_BYTES) {
    return Response.json(
      { error: "That story pass is too large. Please start a new story." },
      { status: 413 },
    );
  }
  return null;
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
