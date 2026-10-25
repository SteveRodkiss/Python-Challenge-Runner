import { createEditor } from "./editor.js";
import { Runner } from "./runner.js";
import { Terminal } from "./terminal.js";
import { DebuggerView } from "./debugger.js";
import { renderTests } from "./tests.js";

const DEFAULT_CODE = `# Welcome! Press Run to try this program.
name = "Python"
for i in range(3):
    print("Hello,", name, i)
`;

async function loadChallenges() {
  try {
    const res = await fetch("data/challenges.json");
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (err) {
    console.error("Could not load challenges:", err);
    return [];
  }
}

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked in iframe */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* storage blocked in iframe */ } },
};

const params = new URLSearchParams(location.search);
let theme = params.get("theme") || store.get("theme") || "dark";
let fontSize = Number(store.get("fontSize")) || 16;
document.documentElement.dataset.theme = theme;

const term = new Terminal($("terminal"));
let current = null; // selected challenge
let busy = false;
let pythonReady = false;

const runner = new Runner({
  onOutput: (text, stream) => term.write(text, stream),
  onReady: () => { pythonReady = true; updateUi(); },
});

const editor = await createEditor($("editor"), {
  code: DEFAULT_CODE,
  theme,
  fontSize,
});
const dbg = new DebuggerView(editor);
const errorMarks = editor.createDecorationsCollection();

function updateUi() {
  $("btn-run").disabled = $("btn-debug").disabled = busy || !pythonReady;
  $("btn-test").disabled = busy || !pythonReady || !current?.tests?.length;
  $("btn-test").title = current ? "Check your code against the challenge tests" : "Pick a challenge to unlock tests";
  $("btn-stop").disabled = !busy;
  $("status").textContent = busy ? "Running…" : pythonReady ? "Ready" : "Loading Python…";
}

function showTab(name) {
  for (const t of ["output", "debugger", "tests"]) {
    $("tab-" + t).classList.toggle("active", t === name);
    $("panel-" + t).classList.toggle("hidden", t !== name);
  }
  dbg.setActive(name === "debugger");
}

async function execute(debug, presetInputs = []) {
  if (busy || !pythonReady) return;
  busy = true;
  updateUi();
  dbg.clear();
  errorMarks.clear();
  showTab("output");
  const code = editor.getValue();
  const inputs = [...presetInputs];

  try {
    for (;;) {
      term.clear();
      const result = await runner.run(code, inputs, debug);
      if (result.needInput) {
        const answer = await term.readLine();
        if (answer === null) throw new Error("stopped");
        inputs.push(answer);
        continue;
      }
      if (result.errorLine) {
        errorMarks.set([{
          range: new window.monaco.Range(result.errorLine, 1, result.errorLine, 1),
          options: { isWholeLine: true, className: "error-line" },
        }]);
      }
      if (debug) {
        dbg.load(code, result);
        showTab("debugger");
      }
      break;
    }
  } catch (err) {
    if (err.message === "stopped") term.write("\n[Program stopped]\n", "info");
    else term.write("\n" + err.message + "\n", "stderr");
  } finally {
    busy = false;
    updateUi();
  }
}

async function runTests() {
  const tests = current?.tests;
  if (busy || !pythonReady || !tests?.length) return;
  busy = true;
  updateUi();
  dbg.clear();
  errorMarks.clear();
  showTab("tests");
  const code = editor.getValue();
  try {
    const result = await runner.check(code, tests);
    if (result.errorLine) {
      errorMarks.set([{
        range: new window.monaco.Range(result.errorLine, 1, result.errorLine, 1),
        options: { isWholeLine: true, className: "error-line" },
      }]);
    }
    renderTests($("tests-results"), tests, result, (inputs) => execute(true, inputs));
  } catch (err) {
    $("tests-results").textContent = err.message === "stopped" ? "Tests stopped." : err.message;
  } finally {
    busy = false;
    updateUi();
  }
}

function stop() {
  if (!busy) return;
  pythonReady = false; // the worker restarts; onReady re-enables the buttons
  term.cancelInput();
  runner.stop();
}

$("btn-run").onclick = () => execute(false);
$("btn-debug").onclick = () => execute(true);
$("btn-test").onclick = runTests;
$("btn-stop").onclick = stop;
$("btn-clear").onclick = () => term.clear();
$("tab-output").onclick = () => showTab("output");
$("tab-debugger").onclick = () => showTab("debugger");
$("tab-tests").onclick = () => showTab("tests");

editor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter, () => execute(false));

// Code is saved per challenge (keyed by name); unchanged starter code isn't stored,
// so later edits to a challenge's starter text still reach students.
const codeKey = (c) => (c ? "code:" + c.name : "code");
editor.onDidChangeModelContent(() => {
  const code = editor.getValue();
  if (current && code === current.code) store.remove(codeKey(current));
  else store.set(codeKey(current), code);
  errorMarks.clear();
});

const select = $("examples");
const challenges = await loadChallenges();
challenges.forEach((c, i) => select.add(new Option(c.name, i)));
current = challenges[Number(store.get("challenge"))] ?? challenges[0] ?? null;

function showChallenge(challenge) {
  current = challenge;
  if (current) select.value = challenges.indexOf(current);
  store.set("challenge", select.value);
  editor.setValue(store.get(codeKey(current)) ?? current?.code ?? store.get("code") ?? DEFAULT_CODE);
  dbg.clear();
  errorMarks.clear();
  $("tests-results").textContent = "";
  updateUi();
}

select.onchange = () => showChallenge(challenges[Number(select.value)] ?? null);
$("btn-reset").onclick = () => {
  if (!current) return;
  if (confirm("Start this challenge again? Your code for it will be replaced.")) editor.setValue(current.code);
};
showChallenge(current);

function setFont(size) {
  fontSize = Math.max(10, Math.min(32, size));
  editor.updateOptions({ fontSize });
  store.set("fontSize", fontSize);
}
$("btn-font-up").onclick = () => setFont(fontSize + 2);
$("btn-font-down").onclick = () => setFont(fontSize - 2);
$("btn-theme").onclick = () => {
  theme = theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  window.monaco.editor.setTheme(theme === "light" ? "vs" : "vs-dark");
  store.set("theme", theme);
};

updateUi();
