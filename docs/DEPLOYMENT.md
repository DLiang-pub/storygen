# Deployment reference

This is the technical reference for running StoryGen beyond one private local
copy. First-time users should begin with
[Make one for your child](GETTING-STARTED.md).

## Online requirement

- **A Cloudflare-compatible runtime:** the online environment where the app's
  server code runs. It must provide named connections called `DB`, `ASSETS`,
  and `IMAGES` for the counter database, bundled files, and image resizing.

## Local D1 setup

`npm run setup:local` creates the private, local request-counter database and
applies the packaged migration (the instructions that create or update its
table). Running it again is safe; it reports when there is nothing new to
apply.

The one-command local database setup is for testing on one computer. Putting
the app online still requires a separate Cloudflare D1 database and migration.

`npm run setup:local` runs Wrangler's local D1 migration command with
`wrangler.local.jsonc`. That file deliberately uses the same `DB` binding,
database name, placeholder database ID, and `drizzle/` migration directory as
the Vite development configuration. Both commands therefore resolve to the
same project-local Miniflare database under the ignored `.wrangler/` directory.
The placeholder ID is not a production database credential and cannot address
a remote D1 database. Applying the command again is idempotent because Wrangler
records the applied migration.

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
[ARCHITECTURE.md](ARCHITECTURE.md).

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
requests it has seen, and when that counter should expire. The exact D1 schema
is:

```text
storygen_request_limits
  key        TEXT PRIMARY KEY
  count      INTEGER NOT NULL
  expires_at INTEGER NOT NULL
```

`key` is the unique anonymous bucket identifier, `count` is the accepted
request count, and `expires_at` is its expiry time. `TEXT PRIMARY KEY` means the
text key uniquely identifies a row; `INTEGER NOT NULL` means the number must be
present.

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
publish this kind of website. The getting-started guide does not publish the
app: putting a paid key behind a web address requires separate access
protection. A maintainer making a new online copy must:

1. create a new hosting project—the service's container for this online copy;
2. create a Cloudflare D1 counter database and connect it under the name `DB`;
3. apply the database-table instruction kept in the `drizzle/` folder;
4. store `OPENAI_API_KEY` in the host's protected secret field, where it is not
   exposed to visitors or recorded by GitHub;
5. build and test the same set of project files that will be published; and
6. add an appropriate sign-in or other access restriction, plus OpenAI spending
   safeguards, before sharing the web address.

The code-level service boundaries and local database mechanics are in
[ARCHITECTURE.md](ARCHITECTURE.md). Online hosting screens and commands can
change, so this repository does not claim a one-command protected deployment.
The tested parent-friendly local path starts in
[GETTING-STARTED.md](GETTING-STARTED.md).

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

See [SECURITY.md](../SECURITY.md) for responsible reporting.
