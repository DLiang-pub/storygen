/** Cloudflare Worker entry point for StoryGen. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  STORY_CHILD_NAME?: string;
  STORY_CHILD_APPEARANCE?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// These character sheets are bundled with the deployment so the page-art API
// can load canonical references through env.ASSETS. They are runtime-protected
// site content and must never be served directly to a browser.
const PRIVATE_REFERENCE_PATHS = new Set([
  "/story/sam-character-reference.webp",
  "/story/brick-snatcher-reference.webp",
  "/story/giggle-glitch-reference.webp",
  "/story/gear-king-reference.webp",
]);

function isPrivateReferencePath(pathname: string) {
  return PRIVATE_REFERENCE_PATHS.has(pathname)
    || [...PRIVATE_REFERENCE_PATHS].some((privatePath) => pathname.endsWith(privatePath));
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (isPrivateReferencePath(url.pathname)) {
      return new Response("Not found", {
        status: 404,
        headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname === "/_vinext/image") {
      const source = url.searchParams.get("url");
      if (source) {
        try {
          if (isPrivateReferencePath(new URL(source, request.url).pathname)) {
            return new Response("Not found", {
              status: 404,
              headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
            });
          }
        } catch {
          // The image optimizer will return its normal validation response.
        }
      }
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => {
          const assetUrl = new URL(path, request.url);
          if (isPrivateReferencePath(assetUrl.pathname)) {
            return Promise.resolve(new Response("Not found", { status: 404 }));
          }
          return env.ASSETS.fetch(new Request(assetUrl));
        },
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
