# Git Academy

A no-login, static learning website for **Git → GitHub → GitHub Actions**.

**Live:** https://knbreddy.github.io/version-control-academy/

## Current experience

- 9 topic modules / 36 focused theory lessons
- 30 guided practice lab instructions with prerequisites and expected verification steps
- 57 review flashcards
- 27 short quiz questions across 9 modules, with feedback and stored scores
- A beginner Git playground with 8 guided commands
- A branching and merging simulator with a 19-step walkthrough, including a conflict and two-parent merge
- 4 interactive engineering missions (12 decisions): selective staging, merge conflicts, PR review, and CI troubleshooting
- Browser-local progress tracking, export/import for lesson and lab progress
- Anonymous use: no login, data collection, or backend

## Learning paths

Start with the [academy](https://knbreddy.github.io/version-control-academy/).

- [First-commit simulator](https://knbreddy.github.io/version-control-academy/playground.html)
- [Branch/merge simulator](https://knbreddy.github.io/version-control-academy/branch-lab.html)
- [Interactive engineering missions](https://knbreddy.github.io/version-control-academy/missions.html)
- [Module quizzes](https://knbreddy.github.io/version-control-academy/quizzes.html)

**Simulation limitations:** The interactive terminals are teaching models, not full Git shells. The decision missions and quizzes do not run against GitHub's APIs. For genuine pushes, PR reviews, and workflows, complete the external labs with your own GitHub account.

## GitHub Pages and testing

GitHub Actions runs `node tests/site.test.cjs` before deploying the public site. The smoke tests validate content mappings, JavaScript syntax, the full first-commit sequence, the two-parent merge scenario, all four missions with retries, and every quiz. GitHub Pages deploys from `main`.

## Not yet covered by automated tests

Visual responsive-browser tests, screen-reader testing, full Git fidelity, and a complete browser-based YAML/Actions execution engine. The curriculum is still being deepened; passing smoke tests is not a substitute for a learner usability review.
