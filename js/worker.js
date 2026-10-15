/* Web worker: hosts Pyodide so the page stays responsive and Stop can kill runaway code. */
const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
importScripts(PYODIDE_URL + "pyodide.js");

const ready = (async () => {
  const pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  const source = await (await fetch("../py/runtime.py")).text();
  pyodide.runPython(source);
  self.postMessage({ type: "ready" });
  return { run: pyodide.globals.get("run"), check: pyodide.globals.get("check") };
})();

ready.catch((err) => self.postMessage({ type: "fatal", message: "Could not load Python: " + err }));

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    const py = await ready;
    let json;
    if (msg.type === "run") {
      const emit = (stream, text) => self.postMessage({ type: "out", stream, text });
      json = py.run(msg.code, JSON.stringify(msg.inputs), msg.debug, emit);
    } else if (msg.type === "check") {
      json = py.check(msg.code, JSON.stringify(msg.tests));
    } else {
      return;
    }
    self.postMessage({ type: "done", result: JSON.parse(json) });
  } catch (err) {
    self.postMessage({ type: "fatal", message: String((err && err.message) || err) });
  }
};
