# Architecture

## Scope

StoryGen is a single-family, browser-local story application with server-side
OpenAI calls. It has no user-account system and no server-side story library.

## Origin

The project began with a six-year-old's drawing. The requested story was
“happy, scary, and then happy again.” A parent wanted the drawing itself to
appear in the book, not merely inspire the text.

## Main flow

```text
studio
  └─ choose and preprocess upload
      └─ start background story
          └─ poll status
              └─ reader with nine planned pages
                  ├─ page 1 image establishes consistency anchor
                  └─ pages 2–9 generate with bounded concurrency
                      └─ finish / save to local shelf / read again
```

The client has three main modes in `app/page.tsx`: studio, making, and reader.
Several generation and recovery states are represented by flags and per-page
illustration statuses rather than by a separate state-machine library.

## Upload preparation

The browser validates JPG, PNG, or WebP input and creates reduced JPEG data URLs
before generation. One larger copy is used for multimodal story planning and a
smaller copy is used as the recurring creation reference for page art. The
original file is not sent byte-for-byte.

## Story planning

1. `POST /api/generate-story` validates same-origin input, claims the D1 story
   allowance, and starts an OpenAI Responses API job in background mode.
2. The server returns a signed continuation token rather than the story.
3. `POST /api/generate-story-status` polls the provider job.
4. The story output must match a strict nine-page JSON schema.
5. A single bounded correction job can run if the first completed output fails
   validation.
6. Successful completion returns the plan plus a signed art pass bound to the
   reduced creation reference.
7. `DELETE /api/generate-story-status` requests cancellation when the client
   abandons an active job.

The current text model is `gpt-5.6-terra`, with low reasoning effort and a
5,000-token output ceiling.

## Illustration generation

`POST /api/generate-page-image` verifies:

- same origin;
- request size;
- the signed art pass;
- the page number and story plan;
- the upload digest; and
- D1 page, client, global, art-pass, and per-page allowances.

The server loads the canonical fictional story-child reference and optional
villain reference from the bundled ASSETS binding. It sends those references,
the reduced upload, and the page prompt to `/v1/images/edits` using
`gpt-image-2`. The story-child display name and appearance description come
from deployment variables, with the fictional Sam identity as the committed
default.

Page 1 is painted first. Its output is signed as the visual consistency anchor.
The client then paints pages 2–9 with up to four concurrent requests and sends
the signed page-one image as an additional reference. Each page has explicit
loading, ready, and error states and can be retried within the guard limits.

## API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/generate-story` | POST | Start a background story-planning job |
| `/api/generate-story-status` | POST | Poll, validate, correct, and finalize a job |
| `/api/generate-story-status` | DELETE | Cancel an active provider job |
| `/api/generate-page-image` | POST | Generate one page illustration |
| `/api/story-allowance` | GET | Read hourly and daily story allowance |

Generation responses use `Cache-Control: no-store`. Route inputs are validated,
but same-origin checks are not user authentication.

## Persistence

### IndexedDB

Database: `storygen2-local`

Store: `bedtime-stories`

The app keeps:

- one resumable current story;
- up to eight archived stories;
- page text and generated images;
- per-page illustration status and error text;
- the current page;
- the reduced upload while unfinished art may need it; and
- time-limited signed tokens while unfinished art may need them.

The archive logic removes or retains generation material according to whether
all art is complete and whether the art pass has expired. IndexedDB is local to
the browser/device and is not synchronized.

### localStorage

Only the manual night-mode choice and last-used recipe preferences are stored
in localStorage.

### D1

D1 contains short-lived anonymous count/expiry rows. Client fingerprints are
HMAC-derived from an address value and the server secret. No raw upload, story,
or generated image column exists.

The exact schema and local migration mechanics are in
[DEPLOYMENT.md](DEPLOYMENT.md#database).

### Static assets

Character reference sheets are bundled so server routes can load them through
`env.ASSETS`. The Worker returns 404 for direct browser and image-optimizer
requests to those paths. A public source repository still exposes the files
themselves.

The deployment variables `STORY_CHILD_NAME` and `STORY_CHILD_APPEARANCE`
customize the story-child prompt identity. They are not authentication
credentials, but personalized values may still be private family information
and should not be committed to a public source tree. A deployer changing that
identity must also replace the bundled
`public/story/sam-character-reference.webp` with a matching, authorized
character sheet.

## Trust boundaries

```text
Parent's browser
  | reduced uploads, choices, signed tokens
  v
StoryGen Worker
  | server-side API key
  |-- D1: anonymous counters only
  |-- ASSETS: canonical reference images
  |-- IMAGES: static image optimization
  v
OpenAI API
  | story plan and generated page art
  v
Parent's browser IndexedDB
```

The browser is untrusted. Signed tokens prevent it from freely substituting a
different story, upload, or consistency anchor. The server secret is also used
to derive anonymous rate-limit keys, so a rotation invalidates active jobs and
art passes.

## Spending controls

The guard counts accepted requests in rolling buckets and fails closed when D1
or the signing secret is unavailable. It limits story starts, page requests,
per-story art attempts, and per-page attempts. It does not know API prices,
token usage, billing balance, or whether a provider later charges for a failed
request.

## Technology

- **Next.js 16 and React 19:** tools used to build the screens and app behavior.
- **vinext and Vite:** tools that package the app so it can run on Cloudflare.
- **Cloudflare Workers:** the service that runs the server-side code close to
  visitors without requiring the parent to manage a physical server.
- **Cloudflare D1:** the small database used only to count requests.
- **Cloudflare asset and image bindings:** named connections that let the app
  serve its bundled files and resize images.
- **OpenAI Responses API and Image Edits API:** the two OpenAI services used to
  plan the story and paint new illustrations.
- **IndexedDB and localStorage:** storage inside the browser for books and small
  preferences.
- **Drizzle:** a database tool used here to describe and create the one counter
  table.

The current source uses `gpt-5.6-terra` for story planning and `gpt-image-2`
for illustrations. These names identify the two OpenAI models (the particular
AI systems doing the work). A live copy needs an OpenAI project that can use
both models.

## How this was built

StoryGen was built end-to-end with AI coding agents directed through written
instructions, rather than by typing the implementation line by line. Those
instructions set the product behavior, privacy boundaries, generation flow, and
visual direction. Structured audits required the agents to support claims with
specific files and measurements. Speed work used real timing measurements
rather than guesses. Accessibility work included calculated color-contrast
tables and repeated checks against WCAG (the Web Content Accessibility
Guidelines). Mobile screenshots and step-by-step design reviews kept the app
close to the intended picture-book experience. Automated builds and tests
checked each revision before publication. The maintainer reviewed and directed
the result and remains responsible for the online copy.

## Deliberate non-features

- no application authentication;
- no server-side story archive;
- no account profiles;
- no cross-device synchronization;
- no R2 binding;
- no second AI provider; and
- no application analytics integration.
