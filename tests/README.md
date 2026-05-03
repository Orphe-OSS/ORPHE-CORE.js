# Tests

Plain-Node test harnesses for the helper modules in `js/`. No test framework
is used — each file is a standalone Node script that exits `0` on pass and
`1` on failure. This keeps the test surface obvious and avoids adding a
`package.json` dependency tree to the repo.

## Run individually

```bash
node tests/core-analytics.test.js
node tests/core-recorder.test.js
```

Both scripts print one line per test (`ok` or `FAIL`) followed by a summary
line, then exit with the appropriate code.

## Run together (smoke)

```bash
node tests/core-analytics.test.js && node tests/core-recorder.test.js
```

## Adding tests

- One file per helper module (`core-<name>.test.js`).
- No external dependencies. Use `assert(condition, message)` and approximate
  comparisons via the local `approx` helper.
- Keep tests deterministic by injecting a fake clock through the module's
  `now` option.
- Each test should fit on one screen and read top-to-bottom.

## Status

- `tests/core-analytics.test.js` — added in PR `claude/core-analytics-tests`,
  exercises lifecycle, summary, baseline, symmetry, CMJ, and rolling
  queries. 30 cases.
- `tests/core-recorder.test.js` — added in PR `claude/core-recorder-tests`.

These tests are not yet wired into CI. Adding a CI step is a separate
decision that belongs to Codex.
