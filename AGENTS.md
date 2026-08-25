# Repository Rules for AI Agents

These instructions apply to every AI agent and every task in this repository.
Read this file before inspecting, changing, committing, or publishing project
files. Preserve existing user work and follow any more specific `AGENTS.md`
found below the directory you are editing.

## Version control is mandatory

- Treat every completed logical change as a release. Do not leave completed work
  only in the working tree.
- Keep unrelated changes separate. Each logical change must have its own atomic
  commit and its own Semantic Versioning version.
- Use [Semantic Versioning](https://semver.org/): increment PATCH for fixes,
  documentation, maintenance, and other backwards-compatible refinements;
  increment MINOR for backwards-compatible features; increment MAJOR for
  breaking changes. While the project is below `1.0.0`, breaking changes may
  increment MINOR when that intent is clearly recorded in the changelog.
- Keep the version in `package.json` and `package-lock.json` synchronized.
- Maintain `CHANGELOG.md` in English, following Keep a Changelog categories.
  Before a release, move the relevant notes from `Unreleased` into a dated
  version section. Do not add release notes in another language.
- Use a clear Conventional Commit-style message, create an annotated tag named
  `v<version>`, and never move or reuse an existing release tag.
- Before committing, run the relevant tests, typecheck, and build. Record any
  check that cannot be run in the handoff.
- After committing, push the current branch and its release tag to `origin`.
  Work is not complete until both are present on GitHub. Never force-push or
  rewrite published history unless the user explicitly requests it.
- If GitHub is unavailable or push permission is missing, keep the commit and
  tag locally, report the exact blocker, and do not claim the release is
  published.

## Release checklist

1. Inspect `git status` and the latest tags without discarding existing work.
2. Choose the next unused SemVer version based on the change.
3. Implement and verify one logical change.
4. Update the English `CHANGELOG.md` and both package version files.
5. Commit the complete release, add its annotated `v<version>` tag, and push
   the branch and tag to GitHub.
6. Confirm the working tree is clean and the remote branch/tag exist.
