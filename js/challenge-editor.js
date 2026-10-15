/* CRUD editor for data/challenges.json. */
const $ = (id) => document.getElementById(id);
const canWrite = "showOpenFilePicker" in window;
const PICKER_TYPES = [{ description: "Challenges JSON", accept: { "application/json": [".json"] } }];

let challenges = []; // working copy; tests use editable text fields (see toEditable)
let selected = -1;
let fileHandle = null;
let dirty = false;

const lines = (v) => [].concat(v ?? []).map(String);
const toEditable = (c) => ({
  name: c.name ?? "",
  code: c.code ?? "",
  tests: (c.tests ?? []).map((t) => ({
    description: t.description ?? "",
    inputs: lines(t.inputs).join("\n"),
    expect: lines(t.expect).join("\n"),
    reject: lines(t.reject).join("\n"),
  })),
});
const blankTest = () => ({ description: "", inputs: "", expect: "", reject: "" });

const splitLines = (text) => {
  const out = text.split("\n").map((l) => l.replace(/\r$/, ""));
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
};
const nonEmpty = (text) => splitLines(text).filter((l) => l.trim() !== "");

function toJson() {
  return challenges.map((c) => ({
    name: c.name.trim(),
    code: c.code,
    tests: c.tests.map((t) => {
      const expect = nonEmpty(t.expect);
      const reject = nonEmpty(t.reject);
      const test = { inputs: splitLines(t.inputs) };
      if (t.description.trim()) test.description = t.description.trim();
      test.expect = expect.length === 1 ? expect[0] : expect;
      if (reject.length) test.reject = reject.length === 1 ? reject[0] : reject;
      return test;
    }),
  }));
}

function problems() {
  const found = [];
  challenges.forEach((c, i) => {
    const label = c.name.trim() || `Challenge ${i + 1}`;
    if (!c.name.trim()) found.push(`${label}: needs a name.`);
    c.tests.forEach((t, j) => {
      if (!nonEmpty(t.expect).length) found.push(`${label}, test ${j + 1}: needs something under "Output should contain".`);
    });
  });
  return found;
}

function setDirty(value = true) {
  dirty = value;
  $("btn-save").disabled = !dirty;
  $("status").textContent = (fileHandle ? fileHandle.name : "data/challenges.json (not linked to a file)") + (dirty ? " — unsaved changes" : "");
}

function banner(text, ok = false) {
  const b = $("banner");
  b.textContent = text;
  b.classList.toggle("ok", ok);
  b.classList.toggle("hidden", !text);
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function renderList() {
  const ul = $("list");
  ul.textContent = "";
  challenges.forEach((c, i) => {
    const title = el("span", { className: "title" + (c.name.trim() ? "" : " untitled"), textContent: c.name.trim() || "(untitled)" });
    const up = el("button", { className: "btn", textContent: "▲", title: "Move up", disabled: i === 0 });
    const down = el("button", { className: "btn", textContent: "▼", title: "Move down", disabled: i === challenges.length - 1 });
    const copy = el("button", { className: "btn", textContent: "⧉", title: "Duplicate" });
    const del = el("button", { className: "btn", textContent: "🗑", title: "Delete" });
    up.onclick = (e) => { e.stopPropagation(); move(i, -1); };
    down.onclick = (e) => { e.stopPropagation(); move(i, 1); };
    copy.onclick = (e) => { e.stopPropagation(); duplicate(i); };
    del.onclick = (e) => { e.stopPropagation(); remove(i); };
    const li = el("li", { className: i === selected ? "selected" : "" }, title, up, down, copy, del);
    li.onclick = () => select(i);
    ul.append(li);
  });
}

function field(labelText, control, hint) {
  const label = el("label", {}, labelText);
  if (hint) label.append(el("div", { className: "hint", textContent: hint }));
  return [label, control];
}

function textarea(value, rows, onInput, placeholder = "") {
  const t = el("textarea", { value, rows, placeholder, spellcheck: false });
  t.oninput = () => { onInput(t.value); setDirty(); };
  return t;
}

function renderForm() {
  const form = $("form");
  form.textContent = "";
  const c = challenges[selected];
  if (!c) {
    form.append(el("div", { className: "ce-empty", textContent: challenges.length ? "Select a challenge on the left." : "No challenges yet. Press “+ New” to create one." }));
    return;
  }

  const name = el("input", { type: "text", value: c.name, placeholder: "e.g. Can You Vote?" });
  name.oninput = () => { c.name = name.value; setDirty(); renderList(); };
  form.append(...field("Name", name));
  form.append(...field("Starter code (pseudocode comments)", textarea(c.code, 10, (v) => { c.code = v; }),
    "Shown in the editor when the student picks this challenge."));

  const head = el("div", { className: "ce-tests-head" }, el("h3", { textContent: `Tests (${c.tests.length})` }));
  const add = el("button", { className: "btn small primary", textContent: "+ Add test" });
  add.onclick = () => { c.tests.push(blankTest()); setDirty(); renderForm(); };
  head.append(add);
  form.append(head);

  c.tests.forEach((t, j) => {
    const box = el("div", { className: "ce-test" });
    const del = el("button", { className: "btn small", textContent: "Remove" });
    del.onclick = () => { c.tests.splice(j, 1); setDirty(); renderForm(); };
    box.append(el("div", { className: "ce-test-head" }, el("span", { textContent: `Test ${j + 1}` }), del));

    const desc = el("input", { type: "text", value: t.description, placeholder: "What the student's program should do" });
    desc.oninput = () => { t.description = desc.value; setDirty(); };
    box.append(...field("Description", desc));

    const cols = el("div", { className: "ce-cols" });
    const col = (labelText, hint, key, rows, placeholder) => {
      const wrap = el("div");
      wrap.append(...field(labelText, textarea(t[key], rows, (v) => { t[key] = v; }, placeholder), hint));
      return wrap;
    };
    cols.append(
      col("Inputs", "One answer per line, given to input() in order.", "inputs", 4, "20"),
      col("Output should contain", "One item per line, in this order. Case and punctuation are ignored.", "expect", 4, "you are old enough to vote"),
      col("Output must NOT contain", "Optional. One item per line.", "reject", 4, "too young"),
    );
    box.append(cols);
    form.append(box);
  });
}

function select(i) {
  selected = i;
  renderList();
  renderForm();
}

function addChallenge() {
  challenges.push({ name: "", code: "# Write your steps here\n\n", tests: [blankTest()] });
  setDirty();
  select(challenges.length - 1);
  document.querySelector("#form input").focus();
}

function remove(i) {
  const name = challenges[i].name.trim() || "this challenge";
  if (!confirm(`Delete “${name}”? This can't be undone (until you reload without saving).`)) return;
  challenges.splice(i, 1);
  setDirty();
  const next = selected > i ? selected - 1 : selected;
  select(Math.min(next, challenges.length - 1));
}

function duplicate(i) {
  const copy = structuredClone(challenges[i]);
  copy.name = (copy.name.trim() || "Untitled") + " (copy)";
  challenges.splice(i + 1, 0, copy);
  setDirty();
  select(i + 1);
}

function move(i, delta) {
  const j = i + delta;
  [challenges[i], challenges[j]] = [challenges[j], challenges[i]];
  setDirty();
  select(selected === i ? j : selected === j ? i : selected);
}

function load(data, handle = null) {
  if (!Array.isArray(data)) throw new Error("The file must contain a list of challenges.");
  challenges = data.map(toEditable);
  fileHandle = handle;
  setDirty(false);
  select(challenges.length ? 0 : -1);
}

async function loadFromServer() {
  try {
    const res = await fetch("data/challenges.json", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    load(await res.json());
    banner(canWrite
      ? "Loaded data/challenges.json. Press “Open file…” and choose it from your copy of the repository so Save can write straight to it."
      : "Loaded data/challenges.json. This browser can't save to disk directly, so use Download and replace data/challenges.json yourself.", true);
  } catch {
    load([]);
    banner("Couldn't load data/challenges.json. Serve this folder (e.g. python -m http.server) or use “Open file…”.");
  }
}

async function openFile() {
  if (dirty && !confirm("Discard your unsaved changes?")) return;
  try {
    if (canWrite) {
      const [handle] = await window.showOpenFilePicker({ types: PICKER_TYPES });
      load(JSON.parse(await (await handle.getFile()).text()), handle);
    } else {
      const input = el("input", { type: "file", accept: ".json,application/json" });
      input.onchange = async () => {
        try { load(JSON.parse(await input.files[0].text())); banner(""); } catch (e) { banner("Couldn't read that file: " + e.message); }
      };
      input.click();
      return;
    }
    banner("Opened " + fileHandle.name + ". Save will write to this file.", true);
  } catch (e) {
    if (e.name !== "AbortError") banner("Couldn't open that file: " + e.message);
  }
}

function checkBeforeSave() {
  const found = problems();
  if (found.length) {
    banner("Fix these first: " + found.join(" "));
    return false;
  }
  return true;
}

async function save() {
  if (!checkBeforeSave()) return;
  if (!fileHandle) {
    if (!canWrite) return download();
    try {
      fileHandle = await window.showSaveFilePicker({ suggestedName: "challenges.json", types: PICKER_TYPES });
    } catch (e) {
      if (e.name !== "AbortError") banner("Couldn't save: " + e.message);
      return;
    }
  }
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(toJson(), null, 2) + "\n");
    await writable.close();
    setDirty(false);
    banner("Saved to " + fileHandle.name + ".", true);
  } catch (e) {
    banner("Couldn't save: " + e.message);
  }
}

function download() {
  if (!checkBeforeSave()) return;
  const blob = new Blob([JSON.stringify(toJson(), null, 2) + "\n"], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: "challenges.json" });
  a.click();
  URL.revokeObjectURL(a.href);
  banner("Downloaded challenges.json. Replace data/challenges.json in your repository with it.", true);
}

$("btn-add").onclick = addChallenge;
$("btn-open").onclick = openFile;
$("btn-save").onclick = save;
$("btn-download").onclick = download;
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (dirty) save(); }
});
window.addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });

loadFromServer();
