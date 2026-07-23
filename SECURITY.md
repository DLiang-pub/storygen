# Security policy

## Supported version

Security fixes are applied to the current `main` branch. Historical snapshots
are not separately supported.

## Reporting a vulnerability

Please use GitHub's private vulnerability-reporting or Security Advisory
feature for the repository. Do not publish exploit details, API credentials,
real child uploads, provider request bodies, or identifying screenshots in a
public issue.

If a credential has been exposed, revoke or rotate it first. History rewriting
does not make a leaked key safe again.

Useful reports include:

- a way to retrieve or expose `OPENAI_API_KEY`;
- bypasses of story or page-generation limits;
- forgery or cross-story reuse of signed jobs, art passes, or page-one anchors;
- unintended disclosure of uploaded pictures, stories, or generated art;
- direct runtime access to bundled character reference sheets; or
- a cross-origin path that can spend the deployer's API budget.

Ordinary model quality, preferred story tone, provider latency, and API billing
disputes are not security vulnerabilities unless they result from a
reproducible protection bypass.

## Current boundaries

- The app is anonymous. Matching `Origin` checks reduce cross-site request
  abuse but do not authenticate a user.
- `OPENAI_API_KEY` must exist only as a managed server secret.
- D1-backed generation limits fail closed when the database or secret is
  unavailable.
- Signed tokens are time-limited and bind work to the relevant story/upload.
- Direct browser requests for canonical character references return 404.
- The repository's `noindex` setting is not an access-control mechanism.

Anyone deploying this source publicly should add access controls, billing
alerts, monitoring that avoids request content, and limits suited to the
expected audience.
