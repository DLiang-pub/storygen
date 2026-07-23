import { env } from "cloudflare:workers";
import {
  getStoryGenerationAllowance,
  type D1Like,
} from "../abuse-guard";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: Request) {
  const runtimeEnv = env as typeof env & { OPENAI_API_KEY?: string; DB?: D1Like };
  const allowance = await getStoryGenerationAllowance({
    database: runtimeEnv.DB,
    request,
    secret: runtimeEnv.OPENAI_API_KEY,
  });
  if (!allowance.ok) {
    return Response.json(
      { error: allowance.error },
      { status: allowance.status, headers: NO_STORE_HEADERS },
    );
  }
  return Response.json(
    {
      availableNow: allowance.availableNow,
      daily: allowance.daily,
      hourly: allowance.hourly,
    },
    { headers: NO_STORE_HEADERS },
  );
}
