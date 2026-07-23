# Privacy

Last updated: 24 July 2026

This document describes the behavior visible in this repository. It is not a
legal compliance certification. A deployer is responsible for reviewing the
laws and provider terms that apply to their users and location.

## Intended use

StoryGen is a parent-supervised family application. It does not provide child
accounts, sign-in, cross-device story sync, advertising, or an application
analytics integration.

## Information a parent can provide

The app can receive:

- a drawing or photograph of a build in JPG, PNG, or WebP format;
- an optional short name for the creation;
- a story world;
- an optional villain;
- up to two extra themes; and
- a reading level.

Avoid uploads that contain unnecessary names, school information, addresses,
location clues, or other identifying details.

## Processing on the device

Before generation, the browser creates reduced JPEG copies of the selected
picture: a larger planning image and a smaller art reference. The original file
is not uploaded byte-for-byte.

The browser stores:

- the current story and up to eight archived stories in IndexedDB database
  `storygen2-local`;
- generated text and illustration data URLs;
- the reduced upload and signed art tokens while they are still needed to
  finish artwork;
- the most recent page; and
- night-mode and recipe preferences in localStorage.

Deleting a shelf story removes that browser copy. Clearing the site's browser
storage removes the local library. There is no built-in cloud backup.

## Information sent to the deployment server and OpenAI

Story planning sends the reduced planning image, optional creation name, and
selected recipe through the deployment server to the OpenAI Responses API. The
deployment's configured story-child name and appearance description are also
included in the planning and illustration prompts; they are deployment-level
settings rather than a browser-stored child profile.

Illustration generation sends the reduced art reference, the story/page
description, a bundled fictional story-child reference, the selected villain
reference when applicable, and the page-one consistency image for later pages
through the deployment server to the OpenAI Images Edits API.

The OpenAI API key remains on the server and is not returned to the browser.

The story request sets `store: false`, but it also uses Responses API background
mode so that the browser can poll a long-running request. OpenAI's current
[data-controls documentation](https://developers.openai.com/api/docs/guides/your-data#v1responses)
states that background mode stores response data to disk for roughly ten
minutes to enable polling. The same documentation describes up to 30 days of
abuse-monitoring retention for `/v1/responses` and `/v1/images/edits`, subject
to an organization's approved data controls, and says API data is not used for
training by default. Provider rules can change; check the linked documentation
before deploying.

Images and files may be scanned for safety. OpenAI documents an exception under
which inputs classified as potential child sexual abuse material may be
retained for manual review even when enhanced retention controls are enabled.

## Information stored by the StoryGen server

The application database stores only short-lived rate-limit records:

```text
key, count, expires_at
```

Client keys are HMAC-derived from the connection address and the server secret.
Application code does not write raw IP addresses, uploaded images, story text,
or generated illustrations to D1. Expired counter rows are removed
opportunistically.

The hosting provider and OpenAI may process ordinary request metadata according
to their own policies. This repository cannot describe or control data that a
deployer adds through external logging, analytics, proxies, or monitoring.

## Public source assets

This repository contains a fictional Sam character reference and related
sample-story artwork; it does not require a real child's likeness for its
committed demonstration. The Worker blocks the character reference sheets from
direct delivery by a deployed app, but public GitHub source files are
downloadable. Their permitted use is described in [ASSETS.md](ASSETS.md).

## No guarantee

Prompts and moderation settings aim for child-appropriate results, but
generative systems can still make mistakes. An adult should review use and stop
or discard any unsuitable output.

## Questions and deletion

For a self-hosted copy, contact that deployment's operator. For this repository,
use a GitHub issue only for non-sensitive questions. Never attach a real child
upload, provider request body, API key, or identifying screenshot to a public
issue.
