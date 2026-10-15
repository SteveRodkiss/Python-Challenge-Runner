/* Renders the results of "Test my code". */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderTests(root, tests, result, onDebug) {
  root.textContent = "";

  if (result.error) {
    root.append(el("div", "test-summary fail", "Your code has an error, so the tests couldn't run."));
    root.append(el("pre", "test-detail stderr", result.error));
    return;
  }

  const passedCount = result.results.filter((r) => r.passed).length;
  const all = passedCount === tests.length;
  root.append(el("div", "test-summary " + (all ? "pass" : "fail"),
    all ? `🎉 All ${tests.length} tests passed!` : `${passedCount} of ${tests.length} tests passed. Keep going!`));

  tests.forEach((test, i) => {
    const r = result.results[i];
    const card = el("div", "test-card " + (r.passed ? "pass" : "fail"));
    const head = el("div", "test-head");
    head.append(el("span", "", `${r.passed ? "✔" : "✘"} Test ${i + 1}`));
    const inputs = test.inputs?.length ? test.inputs.join(", ") : "none";
    head.append(el("span", "test-inputs", `Input: ${inputs}`));
    card.append(head);
    card.append(el("div", "test-want", "Should: " + (test.description || [].concat(test.expect).join(" "))));

    if (!r.passed) {
      card.append(el("div", "test-label", r.reason));
      card.append(el("pre", "test-detail", r.output ? r.output : "(nothing was printed)"));
      const btn = el("button", "btn small accent", "🐞 Debug this test");
      btn.onclick = () => onDebug(test.inputs || []);
      card.append(btn);
    }
    root.append(card);
  });
}
