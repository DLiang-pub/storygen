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

> **Want to make one for your child? [Start here.](docs/GETTING-STARTED.md)**

StoryGen is a parent-supervised bedtime-story app that turns a child's drawing
or photographed build into a fresh, illustrated nine-page adventure starring
your child.

This repository—the project's files and change history on GitHub—is the public,
secret-free source release of a personal family project. It is shared for
inspection, learning, and careful experimentation. It is not a hosted child
account service.

The project began with a six-year-old's drawing. The requested story was
“happy, scary, and then happy again.” A parent wanted the drawing itself to
appear in the book, not merely inspire the text.

## What it does

- accepts a drawing or build photograph in JPG, PNG, or WebP (three common
  picture-file formats);
- reinterprets the creation as a story character, vehicle, object, or backdrop;
- plans a nine-page story for age 6 or ages 7–9;
- optionally adds one of three child-safe villains and up to two extra themes;
- paints nine new landscape illustrations, with page 1 anchoring visual
  consistency for pages 2–9;
- generates up to four later-page illustrations at the same time;
- supports night mode, read-aloud, swipe navigation, a wake lock that keeps the
  screen on while reading, resume, and an eight-book shelf stored on the
  current device; and
- keeps saved stories on the current browser/device rather than in a cloud
  story database.

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

## Parent supervision and privacy

The browser makes the upload smaller, then sends it and the story choices to
the server-side part of your StoryGen copy. In an online copy, that server-side
part runs on Cloudflare. As needed, it forwards the reduced upload, story
choices, story text, bundled character picture, optional villain
picture, and page-1 visual reference to OpenAI, which writes and illustrates
the story. It does this through an API (a structured way for one program to ask
another program for work). Saved stories and generated art live in IndexedDB
(private storage built into that browser on that device). Cloudflare D1, a
small database Cloudflare provides, stores only short-lived request counters.
Those counters use HMAC-derived identifiers (a one-way, secret-key code rather
than a name or email address). The database does not contain uploads, story
prose, or generated illustrations.

Please read [PRIVACY.md](PRIVACY.md) before running or deploying this project.
Parents should avoid uploading pictures with unnecessary identifying details.
Generative output can be imperfect, so an adult should remain in the loop.

## Architecture

In plain language, the browser makes the upload smaller, asks StoryGen's
server-side part to have OpenAI plan and illustrate the story, and saves the
finished book on the device. The route names below are included so someone
inspecting the code can match each step to the program:

```text
Browser
  ├─ resize/compress the selected picture
  ├─ POST /api/generate-story
  │    └─ OpenAI keeps planning while the browser checks for completion
  ├─ POST /api/generate-story-status until complete
  ├─ POST /api/generate-page-image
  │    ├─ page 1 establishes the digitally verified visual reference
  │    └─ pages 2–9 paint up to four pictures at the same time
  └─ save current story and shelf in IndexedDB

GET /api/story-allowance
  └─ D1 short-lived anonymous counters
```

`POST` and `GET` are two ordinary kinds of web request. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the technical route map, the
points where data crosses from browser to server, the save-and-resume design,
and the full generation flow.

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

## Requirements

- **Git:** the free copying tool used to download this project's files and
  change history from GitHub.
- **Node.js 22.13 or newer:** the free program that runs the project's setup,
  build, and test tools.
- **npm:** the installer included with Node.js; it downloads the project's
  listed software packages.
- **An OpenAI API project:** the paid account area that authorizes story and
  illustration requests.
- **A Cloudflare-compatible runtime:** the online environment where the app's
  server code runs. It must provide named connections called `DB`, `ASSETS`,
  and `IMAGES` for the counter database, bundled files, and image resizing.
- **An `OPENAI_API_KEY`:** a private text key that allows the server—not the
  browser—to charge generation requests to the owner's OpenAI account.

The local test needs Git, Node.js, npm, and the OpenAI project. The Cloudflare
online environment and its named connections are needed when the app is put
online.

The API key never belongs in browser code, a file recorded by GitHub, a GitHub
issue, or `.openai/hosting.json`.

## Local development

“Local” means running a private copy on your own computer. On macOS or Linux,
open the Terminal app, move into the downloaded StoryGen folder, and run:

```bash
npm ci
cp -n .dev.vars.example .dev.vars
# Add your own OpenAI API key to the ignored .dev.vars file.
npm run setup:local
npm run dev
```

`npm ci` installs the exact package versions recorded by this repository.
`.dev.vars` is a private local settings file; the project is configured not to
upload it to GitHub.
`npm run dev` starts the local preview and prints the address to open in a web
browser. Windows uses a different safe file-copy command. For Windows or any
first-time, click-by-click setup, use
[Make one for your child](docs/GETTING-STARTED.md).

Useful checks:

```bash
npm run lint
npm test
git diff --check
```

`npm test` builds the app and runs its automatic checks. OpenAI calls in the
included tests are replaced with fake answers and should not spend
OpenAI credit. `npm run lint` looks for common code problems, and
`git diff --check` checks edited files for accidental spacing errors.

`npm run setup:local` creates the private, local request-counter database and
applies the packaged migration (the instructions that create or update its
table). Running it again is safe; it reports when there is nothing new to
apply.

## Runtime configuration

Runtime configuration means the settings supplied when the app is actually
running. Private settings belong in secret storage; ordinary child-description
settings can be visible to the app's server.

### Secret

```dotenv
OPENAI_API_KEY=
```

The same private key also creates temporary digital proofs that connect an
unfinished story, its upload, its page-1 visual reference, and its anonymous
request counters. Replacing the key makes unfinished work stop resuming. The
exact verification design is documented in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Story child

The demonstration identity included in this public project is the fictional
child Sam. An online copy can set its own display name and appearance
description as Cloudflare Worker variables (settings available to the server
code):

```dotenv
STORY_CHILD_NAME=Sam
STORY_CHILD_APPEARANCE=Sam is a fictional six-year-old child with dark brown skin, springy black curls, round teal glasses, an orange-and-cream striped T-shirt, navy overalls, and yellow sneakers.
```

These values are not password credentials, but a real child's name and
description are still personal. Keep personalized values in private online
settings or the ignored local `.dev.vars` file, not in public source files.

`STORY_CHILD_NAME` is used in story and illustration prompts.
`STORY_CHILD_APPEARANCE` supplies the corresponding visual description. Keep
both values suitable for a child-facing story; `{name}` in the appearance value
is replaced with the configured name. To change the visual identity, also
replace `public/story/sam-character-reference.webp` with an authorized character
sheet (a single image showing the character consistently) that matches the
configured description. Changing text alone does not redraw that bundled
picture.

### Bindings

In Cloudflare, a binding is a named connection between the running app and a
service or group of files:

| Binding | Purpose |
| --- | --- |
| `DB` | D1 database containing short-lived request counters |
| `ASSETS` | files bundled with the app, including protected reference sheets |
| `IMAGES` | Cloudflare's image-resizing service |

The small host-configuration file `.openai/hosting.json` lists the binding
names expected when the app is built. It does not contain the OpenAI key or a
reusable identifier for the family's live site.

## Database

StoryGen has one table on the server. A table is the database equivalent of a
small spreadsheet. Each row stores an anonymous counter name, how many accepted
requests it has seen, and when that counter should expire. The exact field
names and database types are preserved in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#server-counter-table).

The application source does not define a server-side table for stories,
uploads, generated art, child profiles, or account data.

## Cost and abuse limits

The person who puts StoryGen online pays the OpenAI API bill. If the link is
available without a sign-in, any visitor can spend that budget, subject to the
app's built-in request counters:

- 8 story starts per anonymous network address per hour (often shared by one
  household);
- 24 story starts across the whole deployed app during each moving 24-hour
  window;
- 72 page-image requests per anonymous network address per hour;
- 216 page-image requests across the whole app during each moving 24-hour
  window;
- 14 accepted page-image requests for each story's temporarily verified
  permission to paint; and
- 3 accepted requests per page.

## Deployment

Deployment means putting the app online at a web address. The project is
packaged by vinext to run on Cloudflare Workers. The existing technical hosting
file also describes the inputs expected by OpenAI Sites, a managed way to
publish this kind of website. This beginner guide does not publish the app:
putting a paid key behind a web address requires separate access protection. A
maintainer making a new online copy must:

1. create a new hosting project—the service's container for this online copy;
2. create a Cloudflare D1 counter database and connect it under the name `DB`;
3. apply the database-table instruction kept in the `drizzle/` folder;
4. store `OPENAI_API_KEY` in the host's protected secret field, where it is not
   exposed to visitors or recorded by GitHub;
5. build and test the same set of project files that will be published; and
6. add an appropriate sign-in or other access restriction, plus OpenAI spending
   safeguards, before sharing the web address.

The code-level service boundaries and local database mechanics are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Online hosting screens and
commands can change, so this repository does not claim a one-command protected
deployment. The tested parent-friendly local path starts in
[docs/GETTING-STARTED.md](docs/GETTING-STARTED.md).

## Known limitations

- The one-command local database setup is for testing on one computer. Putting
  the app online still requires a separate Cloudflare D1 database and migration.
- Saved stories and generated art remain in one browser's IndexedDB. There is
  no cloud backup or cross-device synchronization.
- Same-origin checks (rejecting requests that appear to come from a different
  website) and anonymous counters reduce casual abuse but do not prove who a
  person is or require them to sign in.
- Request-count controls are not a currency-based spending cap. A request
  can still cost money if it fails or is abandoned. Temporary OpenAI service
  failures can trigger a small, limited number of retries. Do not publish a
  deployment backed by a personal paid key without access restrictions,
  billing alerts, and limits suitable for its audience.
- Which AI models are available, how they behave, how long they take, and what
  they cost can change after this version of the source is published.
- Generative text and images can be slow, inconsistent, or unsuitable. An
  adult must supervise use and may need to retry or discard output.
- This source release omits the private keys and identifiers used by the
  family's live copy, its live hosting project ID, and its web address.

## Security boundaries

- Story and picture requests require a matching `Origin` (the website address
  named by the browser), but that check is not a sign-in system.
- The application is anonymous by default and has no account or cloud-sync
  layer.
- The billing-safety check stops requests, rather than allowing uncounted
  spending, when the counter database or private verification key is
  unavailable.
- Temporary digitally verified permission to paint a story is tied to the
  smaller copy of the selected upload.
- The main bundled character sheets are blocked from direct browser delivery by
  the Worker, although they remain visible in this public source repository.
- `noindex` is a request asking search engines not to list a page; it is not a
  password or access restriction.

See [SECURITY.md](SECURITY.md) for responsible reporting.

## Repository policy

StoryGen is intentionally OpenAI-only. Pull requests that add another model
service, move the secret key into browser code, publish real child uploads, or
remove the billing-safety check will not be accepted without explicit maintainer
review. A pull request is a proposed code change submitted for review on
GitHub.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License and media

Source code is available under the [MIT License](LICENSE), a standard license
that permits reuse of the code under its terms. That license does **not** cover
the reserved character art, sample story illustrations, or social artwork
listed in [ASSETS.md](ASSETS.md). Those fictional demonstration media are not
licensed for reuse, for teaching another AI model, or for separate
redistribution.

StoryGen is a personal project and is not affiliated with or endorsed by
OpenAI, the LEGO Group, Mojang, Microsoft, or YouTube.
