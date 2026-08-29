# fix-commit

**Detect, fix, and prevent hardcoded secrets before they reach Git.**

`fix-commit` is a lightweight security tool for Git-based projects that detects potentially exposed secrets in staged files and helps developers remediate them before they are committed.

Unlike traditional secret scanners that primarily report and block leaks, `fix-commit` is designed around a **detect → remediate → verify** workflow.

---

## Overview

Hardcoded credentials can easily make their way into source code:

```javascript
const API_KEY = "sk-xxxxxxxxxxxxxxxx";
```

Once committed and pushed to a remote repository, removing the line from the latest version does not necessarily remove the credential from Git history.

`fix-commit` aims to catch these mistakes **before the commit is created**.

```text
Developer changes
       │
       ▼
  git commit
       │
       ▼
┌──────────────────┐
│   fix-commit     │
│  pre-commit hook │
└────────┬─────────┘
         │
         ▼
   Scan staged files
         │
    ┌────┴────┐
    │         │
   Safe    Secret found
    │         │
    │         ▼
    │     Remediation
    │         │
    │         ▼
    │      Verify
    │         │
    └────┬────┘
         ▼
      Commit
```

---

## Features

### Secret Detection

Detects common credential patterns, including:

* API keys
* Access tokens
* Authentication tokens
* Bearer tokens
* JWTs
* OAuth credentials
* Database connection strings
* Passwords and other high-entropy values

Detection can combine known patterns with entropy-based analysis to identify credentials that do not match a predefined provider pattern.

### Git Pre-Commit Protection

`fix-commit` can integrate with Git's pre-commit hook to inspect changes before they are committed.

Only relevant staged files need to be analyzed during the normal commit workflow.

If a potential secret is detected, the commit can be stopped before the credential reaches the repository.

### Automatic Secret Migration

When a detected secret can be safely transformed, `fix-commit` can help move the credential out of source code and into environment-based configuration.

For example:

**Before**

```javascript
const API_KEY = "sk-xxxxxxxx";
```

**After**

```javascript
const API_KEY = process.env.API_KEY;
```

The corresponding value can be placed in:

```text
.env
```

while a safe template can be maintained in:

```text
.env.example
```

The migration workflow can also ensure that environment files are protected by `.gitignore`.

### Secret Fingerprinting

`fix-commit` can maintain cryptographic fingerprints of previously handled secrets without storing the actual credential value.

This provides a foundation for identifying:

* Previously detected credentials
* Duplicate credentials
* Reintroduced credentials
* Secret resurrection

Actual secret values should never be stored in the fingerprint registry.

### Duplicate Detection

Identify the same credential appearing in multiple locations:

```text
⚠ Duplicate secret detected

src/api.js
src/config.js
tests/config.test.js
```

This can help developers consolidate credentials and reduce unnecessary exposure.

### False-Positive Filtering

Security scanners need to balance detection with developer experience.

`fix-commit` applies filtering for common non-secret values such as:

* Lock files
* Test fixtures
* Documentation examples
* Placeholder values
* UUIDs
* Dates
* Image data
* Documentation URLs

---

## Installation

Run `fix-commit` directly with `npx`:

```bash
npx fix-commit init
```

Or install it globally:

```bash
npm install -g fix-commit
```

---

## Quick Start

### 1. Initialize the repository

From the root of your Git project:

```bash
npx fix-commit init
```

Initialization prepares the project for secret protection and configures the required Git integration.

### 2. Scan the repository

To scan the project:

```bash
npx fix-commit scan --all
```

### 3. Migrate detected secrets

Where automatic migration is supported:

```bash
npx fix-commit migrate --all
```

For non-interactive execution:

```bash
npx fix-commit migrate --all --yes
```

### 4. Commit normally

```bash
git add .
git commit -m "update application configuration"
```

The configured pre-commit hook will check the staged changes before allowing the commit to proceed.

---

## Example Workflow

Suppose a developer accidentally adds:

```javascript
const STRIPE_SECRET_KEY = "sk_test_xxxxxxxxx";
```

A protected commit can detect the credential before it enters Git history:

```text
$ git commit -m "add payment integration"

fix-commit

Scanning staged files...

Potential secret detected
File: src/payment.js
Line: 4
Type: Stripe secret key

Commit blocked.
```

Where a safe migration is available, the workflow can instead assist with moving the value into environment configuration and replacing the hardcoded credential.

---

## Supported Languages

Current source-code support includes:

| Language   | Extensions                    |
| ---------- | ----------------------------- |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| TypeScript | `.ts`, `.tsx`                 |
| Python     | `.py`                         |

Language-specific transformations are handled separately so additional languages can be added without changing the core scanning engine.

---

## Configuration

`fix-commit` maintains project-specific configuration under:

```text
.secretguard/
```

A typical project may contain:

```text
.secretguard/
├── config.json
└── registry.json
```

Example configuration:

```json
{
  "scan": {
    "stagedOnly": true
  },
  "migration": {
    "envFile": ".env"
  },
  "lifecycle": {
    "tracking": true
  }
}
```

Configuration options may evolve as the project develops.

---

## Security Model

`fix-commit` is designed around a simple principle:

> **Do not wait until a secret reaches a remote repository to deal with it.**

The preferred workflow is:

```text
Detect
  ↓
Understand
  ↓
Remediate
  ↓
Verify
  ↓
Commit
```

Secret fingerprints can be used for lifecycle tracking, while the actual secret values remain outside the registry.

---

## Important: Previously Exposed Credentials

`fix-commit` protects the commit workflow, but it cannot make an already-exposed credential safe.

If a secret has already been pushed to GitHub or another remote repository:

1. Revoke the exposed credential.
2. Generate a replacement credential.
3. Update the local environment configuration.
4. Remove the credential from repository history when appropriate.
5. Review other systems where the credential may have been exposed.

**Removing a secret from the latest file does not automatically invalidate the credential or remove it from Git history.**

---

## CLI

Available commands include:

```bash
fix-commit init
fix-commit scan
fix-commit scan --all
fix-commit migrate
fix-commit migrate --all
fix-commit migrate --all --yes
```

For command-specific options:

```bash
fix-commit --help
```

---

## Project Structure

The project is organized around independent components:

```text
src/
├── cli/
├── scanner/
├── migration/
├── lifecycle/
├── git/
└── config/
```

This separation keeps detection, remediation, Git integration, and lifecycle tracking independent and easier to extend.

---

## Development

Clone the repository:

```bash
git clone <repository-url>
cd fix-commit
```

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build or run the package according to the available project scripts:

```bash
npm run build
```

---

## Contributing

Contributions are welcome.

If you want to improve detection, add a new detector, support another language, or improve migration safety:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Add or update tests.
5. Run the test suite.
6. Open a pull request.

Example:

```bash
git checkout -b feature/add-new-detector
```

Please keep pull requests focused and include tests for security-sensitive changes.

---

## Roadmap

The project is actively evolving.

### Core

* [x] Initial npm release
* [ ] Expand secret detectors
* [ ] Improve staged-file scanning
* [ ] Git pre-commit integration
* [ ] Improve false-positive detection

### Remediation

* [ ] Safe `.env` migration
* [ ] Source-code transformation
* [ ] `.gitignore` management
* [ ] Migration verification
* [ ] Recovery and backup improvements

### Secret Lifecycle

* [ ] Secret fingerprint registry
* [ ] Duplicate detection
* [ ] Secret resurrection detection
* [ ] Improved credential lifecycle reporting

### Future

* [ ] Additional programming languages
* [ ] CI/CD integration
* [ ] GitHub integration
* [ ] Interactive CLI
* [ ] Optional web interface

---

## Why fix-commit?

Existing secret scanners are extremely valuable for finding credentials.

`fix-commit` explores a different developer workflow:

**Finding a secret should be the beginning of the fix, not the end of the process.**

The project focuses on bringing detection, remediation, and verification closer to the developer's commit workflow.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## npm

Package: **fix-commit**

```bash
npm install fix-commit
```

If you find the project useful, consider giving the repository a ⭐ and contributing improvements.
