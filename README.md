# Task Time Tracker

A minimal Task Time Tracker (single-file web app) with keyboard shortcuts and localStorage persistence.

What's included
- `timetracker.html` — main app (now references external CSS/JS)
- `timetracker.css` — styles
- `timetracker.js` — app logic
- `tests/run_tests.js` — simple automated tests run in Node using jsdom
- `package.json` — dev dependency on `jsdom` and `test` script

Run tests
1. Install dev dependencies:

```bash
npm install
```

2. Run tests:

```bash
npm test
```

The tests exercise date helpers, navigation button behavior, merge-on-rename, and active-task rename synchronization.

Notes
- The app exposes the instance as `window.taskTracker` to allow programmatic access for tests and debugging.
- Tests run in a headless DOM environment provided by jsdom; they don't require a browser.
