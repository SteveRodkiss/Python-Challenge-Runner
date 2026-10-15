# Python Playground

An embeddable Python editor for students: Monaco editor + Pyodide, with an output terminal and a step-through debugger. Pure HTML/CSS/JS, no build step.

```
index.html        page (entry point)
editor.html       challenge editor (CRUD for data/challenges.json)
js/challenge-editor.js, css/challenge-editor.css   its code and styles
css/styles.css    styles
js/main.js        wiring, run/debug/stop logic
js/editor.js      Monaco setup
js/runner.js      talks to the Pyodide worker
js/worker.js      Web Worker hosting Pyodide
js/terminal.js    output terminal + inline input()
js/debugger.js    debugger UI (variables, next line, output so far)
data/challenges.json  challenges, loaded on page load (see below)
js/tests.js       renders test results
py/runtime.py     Python-side runner and tracer
```

## Publish and embed

1. Push to GitHub, then **Settings → Pages** → deploy from the `main` branch root.
2. In Google Sites: **Insert → Embed → By URL**, paste `https://<user>.github.io/<repo>/`. Or use **Embed code**:

```html
<iframe src="https://<user>.github.io/<repo>/" width="100%" height="700" style="border:0"></iframe>
```

Optional URL parameter: `?theme=light` (default is dark).

## Challenges and tests

Each challenge in `data/challenges.json`:

```json
{
  "name": "Can You Vote?",
  "code": "# starter comments…",
  "tests": [
    { "inputs": ["17"], "description": "Say you are too young",
      "expect": "you are too young to vote", "reject": "old enough" }
  ]
}
```

- `inputs`: answers fed to `input()`, in order.
- `expect`: a string or list of strings that must appear in the printed output, in order.
- `reject` (optional): text that must not appear.
- `description`: what students see.
- Checking is loose: case, punctuation, spacing and extra words are ignored, and `input()` prompts are not counted as output.
- **✔ Test** is enabled once a challenge is picked. A failed test offers "Debug this test", which loads that test's inputs into the debugger.

## Editing challenges

Open `editor.html` (serve the folder first, e.g. `python -m http.server`, then visit `http://localhost:8000/editor.html`). You can add, edit, duplicate, reorder and delete challenges and their tests.

- **Open file…** (Chrome/Edge): pick `data/challenges.json` in your copy of the repository. **Save** (or Ctrl+S) then writes straight back to it.
- Other browsers: use **Download** and replace `data/challenges.json` with the downloaded file.
- Saving is blocked until every challenge has a name and every test has expected output. Commit and push the changed JSON to update the live site.

## Notes

- **Debug** records up to 3000 steps, then lets you step forward/back, play automatically, or drag the slider. Changed variables are highlighted. The editor is read-only while the Debugger tab is open.
- **input()**: the program re-runs with the answers so far (random is seeded so it repeats identically). Avoid relying on the clock in programs that use input().
- **Stop** kills the worker, so endless loops can always be interrupted.
- Needs internet access to load Monaco and Pyodide from jsDelivr. To run locally, serve the folder (e.g. `python -m http.server`); opening `index.html` via `file://` won't work.
- Code is autosaved to `localStorage` when the browser allows it.
