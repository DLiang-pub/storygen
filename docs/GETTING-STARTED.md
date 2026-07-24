# Make one for your child

This guide is for a parent who is comfortable following careful instructions
but has never set up an app or opened a terminal. You do not need to learn
programming. The recommended route is to let an AI coding assistant do the
technical work while it explains what it is doing. An AI coding assistant is a
tool that can inspect project files and operate the terminal with your
approval.

StoryGen is not a ready-made subscription service. You will make your own copy,
connect it to your own paid OpenAI account, and remain responsible for the
pictures sent to OpenAI and the resulting bill.

## 1. What this takes

### Time

- **With an AI coding assistant:** allow about **45–90 minutes** for the first
  local setup, including account setup and one test story.
- **By hand:** allow about **90–150 minutes** if the software below is not
  already on the computer.
- **Later evenings:** opening an already-set-up copy takes seconds. A new
  nine-page story usually takes several minutes to write and illustrate.
- **Putting it online:** allow another **30–90 minutes** as a broad estimate;
  access protection and service setup can take longer for a first-time user.
  This guide deliberately stops after the private local test because an
  internet address backed by your paid key must be protected before use.

A coding-assistant app may require its own subscription or usage payment; that
is separate from the OpenAI API bill for StoryGen and is not included in the
per-story estimate. The manual path avoids that extra setup-tool cost.

“Local” means the app runs privately on your own computer. “Putting it online”
means publishing it at an internet address so another device can reach it.

### Cost per story

At the prices published on **24 July 2026**, budget approximately:

- **US$1.30–$1.60** for a successful nine-page story without a villain; or
- **US$1.80–$2.10** for a successful nine-page story with a villain.

This is a calculated planning range, not a guaranteed invoice. A failed attempt,
an automatic correction, or repainting a page can add cost.
It does not assume that OpenAI will reuse any input at a discount, and it
assumes an ordinary square, portrait, or landscape upload. An unusually wide
panorama can cost more.

The calculation uses the app as it exists in this public project copy:

1. one paid `gpt-5.6-terra` request plans the text and studies the uploaded
   picture;
2. nine paid `gpt-image-2` requests paint the nine pages—those two code-like
   names identify the particular OpenAI systems doing the work;
3. a no-villain story sends reference pictures 26 times across those page
   requests; a villain story sends them 35 times, always at high fidelity
   (OpenAI's term for preserving more detail from the supplied picture);
4. applying OpenAI's linked high-fidelity calculation, the repeated reference
   pictures account for about **US$1.21–$1.84**;
5. nine low-quality 1536×1024 outputs account for about **US$0.045** in total;
   and
6. the story plan and the illustration instructions account for roughly the
   remaining **US$0.10–$0.20**.

OpenAI bills by “tokens,” small units used to measure text and pictures.
“Input” is material sent to the AI; “output” is material it creates. The
current rates used above are:

- `gpt-5.6-terra`: US$2.50 per million input tokens and US$15.00 per million
  output tokens;
- `gpt-image-2`: US$8.00 per million input-image tokens, US$5.00 per million
  input-text tokens, and the current low landscape output price; and
- the high-fidelity reference-image calculation linked from OpenAI's image
  guide.

Check [OpenAI's current pricing](https://developers.openai.com/api/docs/pricing)
and [image-cost guide](https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency)
before relying on the estimate. Prices and model behavior can change.

### The two accounts

1. **OpenAI account — paid use.** OpenAI provides the artificial-intelligence
   services that write and paint each new story. It needs a payment card or
   prepaid credit because those requests are billed separately from a ChatGPT
   subscription.

2. **Cloudflare account — free tier is enough.**
   [Cloudflare](https://dash.cloudflare.com/sign-up) can put the app at an
   internet address and provides the tiny request-counter database. Its
   **Workers Free** plan and included **D1** database allowance are enough for
   normal private family use. Cloudflare calls the program that runs online a
   “Worker” and its small database “D1.”

A Cloudflare account is not needed merely to test StoryGen on one computer, but
it is the second account needed if you later arrange a protected online setup.
Online publication is outside this beginner guide. The free plan
currently includes far more requests and database rows than one family should
need. See [Cloudflare's D1 free allowance](https://developers.cloudflare.com/d1/platform/pricing/)
and [Worker limits](https://developers.cloudflare.com/workers/platform/limits/).

You do **not** need a paid GitHub account. GitHub is the website holding the
public project files, and anyone can copy this public repository—the project
folder together with its recorded change history.

## 2. Recommended: let an AI assistant set it up

StoryGen itself was built by describing intentions, constraints, tests, and
design decisions to AI coding agents. The easiest way to prepare your own copy
is the same: give a capable coding assistant a careful job description and let
it handle the terminal.

A **terminal** is the computer's text-control window. An **AI coding assistant**
is a tool such as ChatGPT Codex, Claude Code, or another agent that can inspect
files and run commands on your computer with your approval.
Use a coding-agent app or mode that has access to local files and the terminal.
An ordinary web chat that can only send messages cannot perform this setup; if
your assistant cannot operate local files, follow the manual path instead.

Before starting:

1. Create or sign in to an [OpenAI API account](https://platform.openai.com/).
   The API is the paid program-to-program service; it is separate from the
   ordinary ChatGPT website.
2. Add billing or prepaid credit.
3. Create a private key on the
   [API keys page](https://platform.openai.com/api-keys). A key is a
   password-like line beginning with `sk-`. Do not paste it into a public chat,
   email, screenshot, GitHub page, or project file that GitHub records.
4. Set both a warning and a hard monthly limit by following
   [OpenAI's spend-limit instructions](https://developers.openai.com/api/docs/guides/spend-limits).
   A warning sends a message but does not stop charges; a hard limit stops most
   further requests after the tracked amount is reached. Enforcement can lag
   slightly, so the final amount can be a little higher.

### Copy-paste setup prompt

Give the following prompt to your AI coding assistant exactly as written:

```text
Help me set up a private local copy of StoryGen for my family. I have never used
a terminal or set up a software project, so explain each step in plain language
before you do it. Tell me what I should see after each step. If you need me to
click, paste, approve, or choose anything, give one clear instruction at a time.

Repository:
https://github.com/DLiang-pub/storygen.git

Rules:
- Work only in a new StoryGen folder that you create for this setup.
- Do not modify or delete any unrelated files or projects.
- Do not display, repeat, log, commit, or send my OpenAI API key anywhere.
- Never ask me to paste the API key into chat. Create the ignored local file
  named .dev.vars from .dev.vars.example, then either open it in a local text
  editor or tell me exactly how to open it so I can paste the key after
  OPENAI_API_KEY= on my own computer.
- Stop and ask for my approval before any action that could cost money,
  including the first real story. Ordinary downloads and the local database
  setup should be free.
- Do not publish the app or make it reachable from the internet in this session.

Please do this:
1. Identify whether this is macOS, Windows, or Linux. Show me how to open the
   terminal if I need to interact with it, and explain that a command is simply
   an instruction typed into that window.
2. Choose an easy-to-find location such as my Desktop. Check that Git, the free
   tool used to copy the project, is installed. If it is missing, install it
   from its official source with my approval.
3. Check whether Node.js 22.13 or newer is installed. Explain that Node.js is
   the free program that runs StoryGen's setup tools. If it is missing or too
   old, install a current supported version from https://nodejs.org/ with my
   approval, then check the version again.
4. Clone https://github.com/DLiang-pub/storygen.git into a new folder. Explain
   that “clone” means copying the public project files and their change history
   onto my computer. Tell me the full folder location.
5. In that folder, run npm ci. Explain that npm is the installer included with
   Node.js and that this command installs the exact software versions listed by
   the project.
6. Create .dev.vars by copying .dev.vars.example without overwriting an existing
   .dev.vars file. Ask me to create my private OpenAI key at
   https://platform.openai.com/api-keys if I have not already done so. Also point
   me to https://developers.openai.com/api/docs/guides/spend-limits and wait
   while I set a monthly warning and a hard spending limit. Let me paste the key
   locally after OPENAI_API_KEY= without showing the key back to me. Confirm only
   that the setting is non-empty, never its value.
7. Run npm run setup:local. Explain that this creates the small private database
   used only to count generation requests and applies the packaged migration,
   which is the file that creates its table. Confirm that
   0000_mature_silhouette.sql was applied or that no migrations remain.
8. Run npm test. Explain that the tests use fake OpenAI replies and should
   not spend API credit. If anything fails, diagnose and fix the setup rather
   than skipping the check.
9. Run npm run dev, keep it running, and give me the exact local address printed
   by the app, usually http://localhost:3000/. Explain that “localhost” means
   this computer only. Open it in my browser if you can; otherwise tell me how.
10. Confirm that the StoryGen home screen loads and that the story allowance is
    available. If it says the allowance is unavailable, stop and repair the
    local database connection before spending anything.
11. Before the first real story, remind me that a normal successful nine-page
    story currently costs about US$1.30–$1.60 without a villain or
    US$1.80–$2.10 with one, and ask for my approval. Only after I approve, walk
    me through uploading a non-sensitive drawing or toy-build photo, naming the
    creation, choosing the recipe, and pressing Make tonight's story.
12. Stay with the test until the text appears and all nine page pictures either
    finish or show a clear retry button. Help me read page 1, explain where the
    draft and saved shelf live, and show me how to stop the local app with
    Control+C in the terminal.

At the end, give me a short record containing: the StoryGen folder location,
the local address, the Node.js version, whether the local migration and tests
passed, and any step I still need to complete. Do not include my API key.
```

### What this prompt was tested to do

The repository's setup path was tested on a Mac with an Apple chip running macOS
26.5 and Node.js 25.6.1, in a new temporary folder with no saved settings or
real secret:

- the public repository copied successfully;
- the required packages installed with `npm ci`;
- the private settings example copied without entering a real key;
- `npm run setup:local` applied
  `drizzle/0000_mature_silhouette.sql`, and a second run safely reported that
  there were no migrations left to apply;
- the application built and its tests using fake OpenAI replies ran without
  using OpenAI credit;
- the development server reached its local address; and
- with a harmless dummy value standing in for the secret, StoryGen's local
  allowance check returned an available allowance.

The last paid step—making a real story—cannot be tested without deliberately
spending the account owner's API credit, so the prompt stops and asks first.
The manual commands are written for macOS, Windows, and Linux, but the complete
clean-folder simulation above was run only on macOS.

## 3. Manual path

This appendix performs the same local setup without an AI assistant.

### Step 1: open the terminal

On a Mac, press **Command+Space**, type **Terminal**, and press **Return**.

On Windows 11, open **Start**, type **PowerShell**, and open **Windows
PowerShell**. PowerShell is Windows' built-in terminal.

On Linux, open the application usually named **Terminal**.

You should see a window with a blinking cursor after a short line of text. A
**command** is one line you type or paste there, followed by **Return** or
**Enter**. Do not type the leading `$` sometimes shown in internet examples;
the commands below do not include one.

Likely problems:

- **No Terminal result on a Mac:** look in Applications → Utilities → Terminal.
- **PowerShell opens a blue or black window:** both are normal; the commands
  below work in either.
- **A work computer blocks the terminal:** use a personal computer or ask its
  administrator. Do not bypass an employer's restrictions.

### Step 2: check the copying tool

Paste:

```text
git --version
```

You should see `git version` followed by a number. Git is the free tool that
copies this public project and records file changes.

Likely errors:

- **`command not found` or “not recognized”:** install Git from
  [git-scm.com/downloads](https://git-scm.com/downloads), accept the normal
  recommended choices, close the terminal, reopen it, and try again.
- **A Mac asks to install command-line developer tools:** choose **Install**,
  wait for it to finish, and run the check again.
- **A very old version appears:** this setup uses only basic Git features, so it
  will usually work. If copying fails later, install the current version.

### Step 3: check the program that runs the setup

Paste:

```text
node --version
```

You should see `v22.13.0` or a higher number. Node.js is the free program that
runs StoryGen and its setup tools.

Likely errors:

- **`command not found` or “not recognized”:** download the current supported
  **LTS** version—the long-support release—from
  [nodejs.org](https://nodejs.org/en/download). Choose the installer for your
  operating system, accept its normal options, close the terminal, reopen it,
  and run the check again.
- **The number starts with `v18`, `v20`, or is lower than `v22.13`:** install a
  newer LTS version from the same official page.
- **The installer asks about extra tools:** the normal Node.js installation is
  enough; optional programming tool bundles are not required here.

Now paste:

```text
npm --version
```

You should see a version number. npm is the software installer included with
Node.js.

Likely errors:

- **`npm` is missing but `node` works:** rerun the official Node.js installer
  and keep its npm option selected.
- **PowerShell says scripts are disabled:** open ordinary **Command Prompt**,
  use the Command Prompt alternatives specifically labelled below, and use the
  same `git`, `node`, and `npm` commands there; or ask a trusted technical
  helper to repair the PowerShell policy.
- **A different version than someone else's screenshot appears:** that is
  normal as long as the command prints a number.

### Step 4: move to an easy-to-find place

On macOS or Linux, paste:

```text
cd ~/Desktop
```

On Windows PowerShell, paste:

```text
cd $HOME\Desktop
```

On Windows Command Prompt, paste:

```text
cd /d %USERPROFILE%\Desktop
```

`cd` means “change folder.” The next copy will land in a new folder named
`storygen` on the Desktop.

You should see no error. To confirm the location, use the command for your
terminal.

On macOS, Linux, or Windows PowerShell:

```text
pwd
```

On Windows Command Prompt:

```text
cd
```

You should see a line ending in `Desktop`. `pwd` means “print the current
folder”; `cd` by itself does the same check in Command Prompt.

Likely errors:

- **The Desktop folder is elsewhere because cloud backup moved it:** open the
  Desktop in the computer's file browser, copy its location, type `cd ` with a
  trailing space, drag the Desktop folder into the terminal, and press Enter.
- **The location check is not recognized:** confirm that you used `pwd` in
  PowerShell or `cd` by itself in Command Prompt.
- **The location contains your user name:** that is expected and stays on your
  computer.

### Step 5: copy the project

Paste:

```text
git clone https://github.com/DLiang-pub/storygen.git
```

“Clone” means copy the public project files and their recorded change history.
You should see lines beginning with `Cloning into 'storygen'` and ending without
an error. A new `storygen` folder should appear on the Desktop.

Likely errors:

- **`destination path 'storygen' already exists`:** do not delete it. Clone the
  new copy under a different name by running
  `git clone https://github.com/DLiang-pub/storygen.git storygen-fresh`, then
  use `cd storygen-fresh` instead of `cd storygen` below.
- **“Could not resolve host” or a connection error:** check the internet
  connection and open
  [the repository](https://github.com/DLiang-pub/storygen) in a browser. Retry
  when GitHub opens normally.
- **Permission denied:** return to Step 4 and choose a folder you own, such as
  the Desktop or Documents folder.

Now paste:

```text
cd storygen
```

You should see no output. The terminal is now “inside” the copied project
folder.

Likely errors:

- **`no such file or directory`:** the clone did not finish; fix the previous
  step first.
- **The folder was renamed:** use `cd ` followed by its actual name.
- **Unsure where you are:** run `pwd` in macOS, Linux, or PowerShell, or `cd` by
  itself in Command Prompt. The line should now end in `Desktop/storygen` or
  `Desktop\storygen`.

### Step 6: install StoryGen's listed packages

Paste:

```text
npm ci
```

This tells npm to install the exact package versions recorded by the project.
It downloads files but does not call OpenAI and should not spend API credit.
You should eventually see a line reporting packages added, followed by the
cursor returning.

Lines containing `warning`, `funding`, or a security-check summary are
informational and do not necessarily mean installation failed. A real failure
normally ends with `npm ERR!` and does not return a successful package count.

Likely errors:

- **`Unsupported engine` or a Node version warning:** repeat Step 3 and install
  Node.js 22.13 or newer.
- **A network timeout:** check the connection and run `npm ci` again. npm can
  reuse files it has already downloaded.
- **`permission denied` or `EACCES`:** do not type `sudo` (an administrator
  override) and do not weaken folder permissions. Move the project into your
  own Desktop or Documents folder and retry, or ask an AI assistant to
  diagnose it.

### Step 7: create the private settings file

On macOS or Linux, paste:

```text
cp -n .dev.vars.example .dev.vars
```

On Windows PowerShell, paste:

```text
if (Test-Path .dev.vars) { Write-Host ".dev.vars already exists; leaving it unchanged." } else { Copy-Item .dev.vars.example .dev.vars }
```

On Windows Command Prompt, paste:

```text
if not exist .dev.vars copy .dev.vars.example .dev.vars
```

The first file is a safe example. The second is your private local settings
file. On macOS, Linux, and PowerShell, success is silent unless the file already
exists. Command Prompt normally prints `1 file(s) copied`. The project is told
not to record `.dev.vars` in GitHub history, but you should still never share
its contents.

Likely errors:

- **The file already exists:** good—do not overwrite it, because it may already
  contain your key. Open the existing `.dev.vars` instead.
- **The example file cannot be found:** run `pwd` in macOS, Linux, or
  PowerShell, or `cd` by itself in Command Prompt. You must be inside the
  `storygen` folder.
- **Windows File Explorer hides files beginning with a dot:** the file still
  exists. Open it with the command below instead of searching visually.

To open the private file, use the command for your computer.

On a Mac:

```text
open -e .dev.vars
```

On Windows:

```text
notepad .dev.vars
```

On Linux:

```text
xdg-open .dev.vars
```

You should see a small text file containing:

```dotenv
OPENAI_API_KEY=
STORY_CHILD_NAME=Sam
STORY_CHILD_APPEARANCE=Sam is a fictional six-year-old child ...
```

Likely errors:

- **The editor says the file does not exist:** return to the copy command and
  confirm you are in the StoryGen folder.
- **Linux does not know `xdg-open`:** open the computer's ordinary text editor,
  choose File → Open, turn on “show hidden files,” and select `.dev.vars`.
- **The file opens as read-only:** the project may be in a protected folder.
  Move the whole `storygen` folder to your Desktop or Documents folder.

Create a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
An OpenAI **project** is simply the billing-and-settings container that owns
the key and its usage. A new key may be shown only once, so keep the page open
until you have pasted it into `.dev.vars`; do not save it in chat or a public
note. Paste it after the equals sign, on the same line:

```dotenv
OPENAI_API_KEY=paste-your-private-key-here
```

Do not add spaces around the equals sign. Save and close the file. You may also
replace Sam's name and description now; [Make it yours](#4-make-it-yours)
explains the matching picture.

Before continuing, set a monthly warning and a hard limit using
[OpenAI's spend-limit instructions](https://developers.openai.com/api/docs/guides/spend-limits).
A warning alone does not stop requests or charges.

Likely errors:

- **The key does not start with `sk-`:** return to the API keys page; a ChatGPT
  password or subscription receipt is not an API key.
- **The key was pasted into chat or another public place:** delete that key in
  the OpenAI dashboard immediately and make a new one.
- **No billing section is available:** confirm that this is an OpenAI API
  account with a project and that your account has permission to manage its
  billing.

### Step 8: create the local request-counter database

Paste:

```text
npm run setup:local
```

This creates a small private database on this computer. The database stores
short-lived request counts; it does not store the child's picture, story text,
or generated art. A **migration** is simply the packaged instruction that
creates its table.

On the first run, you should see
`0000_mature_silhouette.sql` with a successful check mark. On later runs, you
should see `No migrations to apply!` Both are success.

If it asks whether to continue with one local migration, type **y** and press
Enter. This changes only the private counter database inside this StoryGen
folder.

Likely errors:

- **`npm` is not recognized:** return to Steps 3 and 6.
- **The configuration file is missing:** run `pwd` in macOS, Linux, or
  PowerShell, or `cd` by itself in Command Prompt, and confirm you are in the
  freshly copied `storygen` folder.
- **A database connection error persists:** close other StoryGen terminals,
  retry once, then give the full error text—without your key—to an AI coding
  assistant.

### Step 9: run the free automatic checks

Paste:

```text
npm test
```

The app will be built and checked using fake OpenAI replies. This should
not spend API credit. It can take several minutes. You should see all tests
pass and the terminal return to the cursor.

Likely errors:

- **A build runs out of memory or the computer becomes very slow:** close other
  large applications and retry.
- **The error mentions a missing package:** run `npm ci` again, then rerun the
  tests.
- **A test genuinely fails:** do not skip it for an online copy. Copy the
  error text, remove any private paths or secrets, and ask the AI assistant to
  diagnose the freshly copied project.

### Step 10: start the private local app

Paste:

```text
npm run dev
```

Keep this terminal window open. You should see a line similar to:

```text
Local: http://localhost:3000/
```

The number might be `3001` or another nearby number if something else already
uses 3000. The number after the colon is the **port**, the numbered local
doorway used by the app. `localhost` means the app is available only from this
computer.

Likely errors:

- **The port is already in use:** use the new address StoryGen prints; that is
  why it tried another number.
- **The terminal appears to stop at the local address:** that is success. It is
  waiting for the browser and will not return to the cursor until you stop it.
- **A firewall asks for access:** allow private or local-network access only.
  Public-network access is not needed for this local test.
- **The browser says “connection refused”:** confirm the terminal is still
  running and use the exact address it printed. If you changed `.dev.vars`
  after starting, press Control+C, run `npm run dev` again, and reopen the
  address.
- **The page reports a missing or invalid OpenAI key:** stop the app with
  Control+C, correct `OPENAI_API_KEY` in `.dev.vars`, save it, and restart with
  `npm run dev`. Never paste the key into the terminal.
- **A red error appears:** keep the terminal open, copy only the error text
  without `.dev.vars`, and ask an AI assistant to diagnose it.

Open Chrome, Safari, Edge, Firefox, or your usual web browser. Click its address
bar, type the exact `http://localhost:.../` address printed by the terminal, and
press Enter. You should see the StoryGen desk and an available story count.

If the page says the story allowance is unavailable, do not make a story.
Return to the terminal, press Control+C, repeat Step 8, and then restart with
`npm run dev`. If the allowance remains unavailable, stop rather than spending
money and ask a trusted coding assistant for help.

### Step 11: make the first story

This is the first step that intentionally spends OpenAI credit.

1. Choose a drawing or toy-build picture that does not show a school name,
   home address, document, location label, or another child's face.
2. Select the upload area and choose the picture.
3. Give the creation a short name or description.
4. For the lower-cost first test, turn the villain off.
5. Press **Make tonight's story**.
6. Wait for the story text and page 1 picture. Later pictures paint in the
   background.
7. Move through all nine pages. A failed picture should show a button to repaint
   that page rather than forcing a whole new story.
8. Save the finished story to the shelf if you want to keep it in this browser.

You should see nine readable pages and nine new illustrations. Saved stories
live only in this browser on this device; they are not backed up to an online
account. Private/incognito browsing or clearing the browser's site data can
erase the draft and shelf.

Likely errors:

- **“No API credits” or an insufficient-credit message:** check OpenAI API
  billing and the hard monthly limit. A ChatGPT subscription does not include
  API credit. If the message instead says a model is unavailable or access is
  denied, confirm that this OpenAI project can use both model names listed in
  [Cost per story](#cost-per-story).
- **The story appears but one picture fails:** if it says busy or rate-limited
  (OpenAI's temporary pace limit), wait at least one minute or the retry time
  shown before using that page's repaint button. New paid accounts can start
  with a low image-per-minute limit; OpenAI lists the
  [current limits here](https://developers.openai.com/api/docs/models/gpt-image-2).
  Repaint only that page; do not start the entire story again unless the text
  itself failed.
- **Generation stops halfway:** keep the browser tab open, check the draft on
  the home screen, and check the
  [OpenAI usage page](https://platform.openai.com/usage) before retrying.
  Completed pages are
  saved locally as they arrive, but a failed or abandoned request may still
  have cost money.

To stop the local app, return to the terminal and hold **Control** while
pressing **C**. You should return to the normal blinking cursor. The saved shelf
remains in that browser.

Likely problems:

- **Control+C appears to do nothing:** click once inside the terminal, then try
  again.
- **Closing the terminal stopped the site:** expected—the local app runs only
  while `npm run dev` is active.
- **The next evening's address does not open:** open the terminal again. On
  macOS or Linux, run `cd ~/Desktop/storygen`; in PowerShell, run
  `cd $HOME\Desktop\storygen`; in Command Prompt, run
  `cd /d %USERPROFILE%\Desktop\storygen`. If you used `storygen-fresh`, use
  that folder name instead. Then run `npm run dev` and open the new address it
  prints.

## 4. Make it yours

Editing text files is free. Generating or regenerating pictures uses API credit.
Future stories always have their normal generation cost even when a
customization itself was free.

An AI coding assistant is the safest way to make project-file changes because
several lists intentionally appear in both the screen code and the rules that
check completed stories.
Ask it to run `npm test` afterward; those tests use fake OpenAI replies.

The code-styled labels in the table are names a coding assistant can search
for. A parent does not need to understand or type the program around them.

| What to personalize | Exact file or setting | Short before → after | Cost of the change |
| --- | --- | --- | --- |
| Child's name and appearance | For newly generated stories, edit `.dev.vars`: `STORY_CHILD_NAME` and `STORY_CHILD_APPEARANCE`. The defaults included in the project are in `app/story-child.js`; the temporary loading badge is a fixed `S` in `app/page.tsx` near `paint-child`. The matching reference picture is `public/story/sam-character-reference.webp`. The bundled sample remains Sam unless separately replaced as described below. | `Sam` → `Avery`; `Sam is a fictional six-year-old...` → `{name} has silver curls, amber glasses, green overalls, and purple sneakers.`; `paint-child">S` → `paint-child">A` | Text and badge changes: **free**. A new matching character reference: **uses API credit** if AI-generated; free if you draw or supply authorized art yourself. |
| Interest and extra chips | Screen labels and icons: `app/page.tsx` in the `interests` list. Story wording and checks: `app/api/generate-story/story-generator.js` in `interests` and `interestNarrativePatterns`. | `Robots` → `Music`; add `music: "music, rhythm, and homemade instruments"` and words that recognize it in a story. | **Free text/project-file change.** No picture needs regenerating. |
| World scenarios | Screen titles: `app/page.tsx` in `scenarios`. Story descriptions and story checks: `app/api/generate-story/story-generator.js` in `scenarios` and `scenarioNarrativePatterns`. Illustration world names: `app/api/generate-page-image/page-image-generator.js` in `scenarios`. | `Moon Base Builders` → `Enchanted Library Rescue`; add its short plot and words such as `library`, `book`, and `shelves` to the story check. | **Free text/project-file change.** Regenerating the bundled sample to show the new world would use API credit. |
| Villains | Screen choices: `app/page.tsx` in `badGuys`. Story personality: `app/api/generate-story/story-generator.js` in `badGuys`. Visual description: `app/api/generate-page-image/page-image-generator.js` in `badGuys`. The file that matches each villain to its picture: `app/api/generate-page-image/route.ts`. The server list that blocks direct access to those pictures: `worker/index.ts`. | `The Gruff Gear King` → `The Fog Collector`, with a new goal, physical description, and `public/story/fog-collector-reference.webp`. | Wording: **free**. A new consistent villain reference: **uses API credit** if generated. Repainting the nine-page sample is optional and also uses credit. |
| Reading levels | Screen choices: `app/page.tsx` in `ReadingLevel` and `readingLevels`. Story instructions: `app/api/generate-story/story-generator.js` in `readingLevels`. The lists of values accepted when saving or generating a story are in `app/story-storage.ts` and `app/api/generation-token.js`. | `Ages 7–9 — Richer words and more detail` → `Ages 9–11 — Longer suspense and layered clues`. | **Free text/project-file change**, but this touches several matching allowed-value lists and tests. No picture needs regenerating. |
| Art-style direction | Story-planning continuity: `app/api/generate-story/story-generator.js`. Final illustration direction: `app/api/generate-page-image/page-image-generator.js`, near the phrase `watercolor-and-colored-pencil picture-book style`. Character and villain reference files in `public/story/` also steer the look. | `watercolor-and-colored-pencil` → `layered cut-paper collage with visible fibers, soft gouache shading, and hand-inked outlines`. | Changing the instruction words sent to OpenAI: **free**. A coherent visual change requires new character/villain references and new sample pages, so that **uses API credit**. |

### Creating a character reference

The app needs one consistent reference picture even if you prefer not to use a
real photo.

A useful reference:

- shows one child clearly, ideally from head to shoes or at least three-quarter
  length;
- uses a plain, uncluttered background;
- makes hair, skin tone, glasses, clothing colors, and shoes easy to see;
- avoids other people, school logos, location clues, visible documents, and
  heavy filters; and
- matches the picture-book style you want on every page.

You may begin from a family photo that you have the right to use, a child's
drawing, or your own illustration. Supplying a real photo to OpenAI image
generation sends that photo to OpenAI. Use the resulting fictional illustrated
character sheet as the app's reference; do not install the raw family photo as
the repeated page reference. A described character also works well: describe
the age, hair, skin tone, glasses if any, outfit, shoes, and art style to
OpenAI, and ask for a fictional full-body character sheet on a simple
background. A character sheet is one reference picture that clearly establishes
the character's look. The description-only route avoids sending any real
child's photo.

Ask the coding assistant to resize and convert the finished landscape image to
1536×1024 WebP format (a compact web-picture file), place it at
`public/story/sam-character-reference.webp`, and replace the fictional demo
picture. Renaming a JPG file to end in `.webp` does not convert it. Make the
`.dev.vars` description match the new picture. Keeping the existing file name
avoids extra project changes; it is only a project-file name.

If you personalize the sample story included with the app too, its words are in
`app/page.tsx`, its nine pictures are
`public/story/page-1-v2.webp` through `page-9-v2.webp`, and its social-sharing
picture is `public/og-storygen-night.png`. Changing those pictures costs API
credit if you ask OpenAI's image system to regenerate them.

Keep every personalized character reference and sample illustration in a
private local copy or private repository. Never record or push it to a public
copy, even when the result is an illustrated rather than photo-real likeness.
Description-only fictional art is the safest choice for a public copy. The
fictional demo media included here are intentionally safe to inspect.

## 5. Keep it safe and cheap

1. **Set a real OpenAI cap.** Add a warning and enforce a hard monthly spending
   limit in the OpenAI project used by StoryGen. A warning alone does not stop
   requests or charges, and hard-limit enforcement can lag slightly.

2. **Keep the key private.** Put it only in `.dev.vars` for local use or the
   online service's protected secret field. Never put it in browser code, a
   screenshot, a message, or GitHub. Delete and replace the key immediately if
   it is exposed.

3. **Do not share an unprotected online address.** A private-looking link is not
   a password. **Do not post the online address publicly.** Add a sign-in
   or another access restriction appropriate for your family before even
   limited sharing. The free local address beginning with `localhost` is
   available only on that computer.

4. **Understand the built-in limits.** StoryGen counts starts, page requests,
   requests per story, and requests per page. Those counters reduce repeated
   or casual misuse. They do not identify a person, make a public link private,
   measure dollars, stop every automated program, or guarantee that a failed
   request was free.

5. **Recover carefully after a halfway failure.** Keep the tab open and return
   to the saved draft or resume card. Retry only the failed page when that
   button exists. Check the
   [OpenAI usage page](https://platform.openai.com/usage) before starting the
   whole book again, because completed work and some failed requests may already
   be billable. If the text never completed, wait for any temporary limit to
   reset, then make one new attempt rather than repeatedly pressing the start
   button.

For the precise data flow and technical boundaries, see
[ARCHITECTURE.md](ARCHITECTURE.md). For what is and is not sent to OpenAI, see
[the privacy notice](../PRIVACY.md).
