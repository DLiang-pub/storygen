# StoryGen

<p align="center">
  <img
    src="docs/media/hero-transformation.webp"
    alt="A fictional child's crayon creation beside its storybook reinterpretation"
    width="760"
  >
</p>

<p align="center">
  <img
    src="docs/media/reader-screenshot.webp"
    alt="The StoryGen reader showing a fictional sample adventure"
    width="760"
  >
</p>

StoryGen is a parent-supervised bedtime-story app that turns a child's drawing
or photographed build into a fresh, illustrated nine-page adventure starring
your child.

This repository is the public, secret-free source release of a personal family
project. It is shared for inspection, learning, and careful experimentation. It
is not a hosted child account service.

The project began with a six-year-old's drawing. The requested story was
“happy, scary, and then happy again.” A parent wanted the drawing itself to
appear in the book, not merely inspire the text.

## What it does

- accepts a JPG, PNG, or WebP drawing/build photograph;
- reinterprets the creation as a story character, vehicle, object, or backdrop;
- plans a nine-page story for age 6 or ages 7–9;
- optionally adds one of three child-safe villains and up to two extra themes;
- paints nine new landscape illustrations, with page 1 anchoring visual
  consistency for pages 2–9;
- generates up to four later-page illustrations concurrently;
- supports night mode, read-aloud, swipe navigation, wake lock, resume, and a
  local eight-book shelf; and
- keeps saved stories on the current browser/device rather than in a cloud
  story database.

## How this was built

StoryGen was built end-to-end with AI coding agents directed through written
specifications, rather than by hand-writing the implementation line by line.
Those specifications set the product behavior, privacy boundaries, generation
flow, and visual direction. Structured audit requests were used to make the
agents report what the code actually did, with file-level evidence. Performance
work used measured provider latency rather than estimates. Accessibility work
included computed contrast tables and WCAG re-checks after palette changes.
Iterative design reviews compared mobile screenshots and interaction paths
against the intended picture-book experience. Automated builds and tests then
checked each revision before publication. The maintainer reviewed and directed
the resulting implementation and remains responsible for the deployed system.

## Parent supervision and privacy

StoryGen sends the reduced upload, story choices, story text, and bundled
character references through the deployment's server to OpenAI for generation.
The original upload is resized in the browser before it is sent. Saved stories
and generated art live in browser IndexedDB. The D1 database stores only
short-lived request counters keyed by HMAC-derived anonymous identifiers; it
does not contain uploads, story prose, or generated illustrations.

Please read [PRIVACY.md](PRIVACY.md) before running or deploying this project.
Parents should avoid uploading pictures with unnecessary identifying details.
Generative output can be imperfect, so an adult should remain in the loop.

## Architecture

```text
Browser
  ├─ resize/compress the selected picture
  ├─ POST /api/generate-story
  │    └─ OpenAI Responses API background job
  ├─ POST /api/generate-story-status until complete
  ├─ POST /api/generate-page-image
  │    ├─ page 1 establishes a signed visual anchor
  │    └─ pages 2–9 paint with up to four concurrent requests
  └─ save current story and shelf in IndexedDB

GET /api/story-allowance
  └─ D1 short-lived anonymous counters
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the route map, trust
boundaries, persistence design, and generation flow.

## Technology

- Next.js 16 and React 19
- vinext, Vite, and a Cloudflare Worker runtime
- Cloudflare D1, static ASSETS, and image optimization bindings
- OpenAI Responses API and Images Edits API
- IndexedDB and localStorage in the browser
- Drizzle schema and migrations

The current source uses `gpt-5.6-terra` for story planning and `gpt-image-2`
for illustrations. A deployment needs OpenAI project access to those configured
models.

## Requirements

- Node.js 22.13 or newer
- npm
- an OpenAI API project with access to the configured models
- a Cloudflare-compatible runtime providing `DB`, `ASSETS`, and `IMAGES`
  bindings
- an `OPENAI_API_KEY` supplied as a server-side secret

The API key never belongs in browser code, a committed file, a GitHub issue, or
`.openai/hosting.json`.

## Local development

```bash
npm ci
cp .dev.vars.example .dev.vars
# Add your own OpenAI API key to the ignored .dev.vars file.
npm run dev
```

Useful checks:

```bash
npm run lint
npm test
git diff --check
```

`npm test` builds the app and runs the Node test suite. Provider calls in the
committed tests are mocked and should not spend OpenAI credits.

Local generation also requires a D1-compatible database containing the
`storygen_request_limits` table from
`drizzle/0000_mature_silhouette.sql`. Apply that migration to the local
D1-compatible database before starting a generation request.

## Runtime configuration

### Secret

```dotenv
OPENAI_API_KEY=
```

The same server secret currently signs story jobs, art passes, page-one anchors,
and anonymous rate-limit fingerprints. Rotating it invalidates in-progress
signed jobs and art passes.

### Story child

The committed demonstration identity is the fictional child Sam. A deployment
can set its own display name and appearance description as non-secret Worker
variables:

```dotenv
STORY_CHILD_NAME=Sam
STORY_CHILD_APPEARANCE=Sam is a fictional six-year-old child with dark brown skin, springy black curls, round teal glasses, an orange-and-cream striped T-shirt, navy overalls, and yellow sneakers.
```

`STORY_CHILD_NAME` is used in story and illustration prompts.
`STORY_CHILD_APPEARANCE` supplies the corresponding visual description. Keep
both values suitable for a child-facing story; `{name}` in the appearance value
is replaced with the configured name. To change the visual identity, also
replace `public/story/sam-character-reference.webp` with an authorized character
sheet that matches the configured description; changing text alone does not
redraw the bundled reference.

### Bindings

| Binding | Purpose |
| --- | --- |
| `DB` | D1 database containing short-lived request counters |
| `ASSETS` | bundled static assets and runtime-protected reference sheets |
| `IMAGES` | image optimization |

`.openai/hosting.json` contains the portable binding names used by the build.

## Database

StoryGen has one server-side table:

```text
storygen_request_limits
  key        TEXT PRIMARY KEY
  count      INTEGER NOT NULL
  expires_at INTEGER NOT NULL
```

The application source does not define a server-side table for stories,
uploads, generated art, child profiles, or account data.

## Cost and abuse limits

The deployer pays the OpenAI API bill. An anonymous public deployment makes
that budget available to visitors within the application's request-count
limits:

- 8 story starts per anonymous client per hour;
- 24 story starts globally per rolling 24-hour bucket;
- 72 page-image requests per anonymous client per hour;
- 216 page-image requests globally per rolling 24-hour bucket;
- 14 accepted page-image requests per signed story art pass; and
- 3 accepted requests per page.

## Deployment

The project is shaped for OpenAI Sites/vinext on a Cloudflare-compatible Worker
runtime. A new deployment must:

1. create its own hosting project rather than reuse another deployment ID;
2. provision a D1 binding named `DB`;
3. apply the migration in `drizzle/`;
4. set `OPENAI_API_KEY` as a managed server secret;
5. build and test the exact source revision; and
6. configure access controls and budget safeguards before sharing the URL.

## Known limitations

- Local generation needs a provisioned D1-compatible database; this repository
  does not provide a one-command local D1 setup.
- Saved stories and generated art remain in one browser's IndexedDB. There is
  no cloud backup or cross-device synchronization.
- Same-origin checks and anonymous counters reduce abuse but do not identify or
  authenticate a person.
- Request-count controls are not a currency-based spending cap. A request
  can still cost money if it fails or is abandoned, and transient provider
  failures can trigger bounded retries. Do not publish a deployment backed by
  a personal paid key without access controls, billing alerts, and limits
  appropriate to the intended audience.
- Model access, behavior, latency, and pricing can change after this source
  revision is published.
- Generative text and images can be slow, inconsistent, or unsuitable. An
  adult must supervise use and may need to retry or discard output.
- This source release omits production credentials, its production hosting
  project ID, and the paid family deployment URL.

## Security boundaries

- Generation routes require a matching request `Origin`, but same-origin checks
  are not authentication.
- The application is anonymous by default and has no account or cloud-sync
  layer.
- The generation guard fails closed when D1 or its signing secret is
  unavailable.
- Signed art passes are bound to the reduced upload.
- Canonical character sheets are blocked from direct browser delivery by the
  Worker, although they remain visible in this public source repository.
- `noindex` metadata is crawler guidance, not access control.

See [SECURITY.md](SECURITY.md) for responsible reporting.

## Repository policy

StoryGen is intentionally OpenAI-only. Pull requests that add another model
provider, weaken server-only key handling, publish real child uploads, or remove
the spending guard will not be accepted without explicit maintainer review.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License and media

Source code is available under the [MIT License](LICENSE). That license does
**not** cover the reserved character art, sample story illustrations, or
social artwork listed in [ASSETS.md](ASSETS.md). Those fictional demonstration
media are not licensed for reuse, model training, or separate redistribution.

StoryGen is a personal project and is not affiliated with or endorsed by
OpenAI, the LEGO Group, Mojang, Microsoft, or YouTube.
