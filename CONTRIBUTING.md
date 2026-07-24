# Contributing

StoryGen is a small, child-safety-sensitive family project. Thoughtful bug
reports and narrowly scoped improvements are welcome, but maintainers may close
changes that do not fit the project.

## Before opening a change

- Open an issue before a large architectural, provider, identity, or visual
  change.
- Keep the project OpenAI-only unless the maintainer explicitly approves a
  provider change.
- Do not commit API keys, `.dev.vars`, `.env` files, production logs, browser
  storage exports, real child uploads, or screenshots containing private
  content.
- Preserve server-only credentials, signed generation passes, same-origin
  checks, and the D1 spending guard.
- Treat changes to child identity, safety prompts, reference artwork, and public
  privacy statements as high-review areas.

## Development checks

```bash
npm ci
npm run lint
npm test
git diff --check
```

`npm test` builds the app and runs its automatic checks. OpenAI calls in the
included tests are replaced with fake answers and should not spend OpenAI
credit. `npm run lint` looks for common code problems, and `git diff --check`
checks edited files for accidental spacing errors.

Do not spend OpenAI credits merely to submit a code change.

## Pull request notes

Explain:

- the user-visible change;
- any privacy or child-safety impact;
- the expected OpenAI API cost impact;
- failure and recovery behavior;
- mobile/manual checks performed; and
- whether all provider interactions remained mocked in tests.

By contributing source code, you agree that your contribution may be distributed
under the MIT License. Do not contribute media or personal data unless you own
the necessary rights and the maintainer has agreed to its license in writing.

## Repository policy

StoryGen is intentionally OpenAI-only. Pull requests that add another model
service, move the secret key into browser code, publish real child uploads, or
remove the billing-safety check will not be accepted without explicit maintainer
review. A pull request is a proposed code change submitted for review on
GitHub.
