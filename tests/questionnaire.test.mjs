// Run: node --test tests/questionnaire.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tree = require("../questions.js");
const E = require("../lib/engine.js");
const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "questionnaire");

// Answer in order, failing loudly if the gate refuses one.
function walk(steps) {
  let answers = {};
  for (const [qid, answer] of steps) {
    assert.deepEqual(E.check(tree, answers, qid, answer), [], `${qid} was refused`);
    answers = E.apply(tree, answers, qid, answer);
  }
  return answers;
}
const pick = (...picks) => ({ picks });
const text = (t) => ({ text: t });
const names = (list) => list.map((x) => x.name ?? x.id);

test("the tree has no broken references", () => {
  assert.deepEqual(E.validate(tree), []);
});

test("a debug task asks its follow-ups, then the end questions", () => {
  const a = walk([["kind", pick("debug")]]);
  assert.deepEqual(E.queue(tree, a), ["kind", "debug_where", "debug_repro", "summary", "check"]);
  assert.equal(E.current(tree, a), "debug_where");
});

test("a debug task on the screen loads the debug and UI skills and the repro rules", () => {
  const a = walk([
    ["kind", pick("debug")],
    ["debug_where", pick("screen")],
    ["debug_repro", pick("always")],
    ["summary", text("The list view draws the last row twice.")],
    ["check", text("The snapshot test for the list view passes.")],
  ]);
  assert.equal(E.current(tree, a), null);
  const d = E.derive(tree, a);
  assert.deepEqual(names(d.skills), ["debug", "root-cause", "ui-check"]);
  assert.ok(names(d.rules).includes("repro-first"));
  assert.ok(names(d.rules).includes("real-screen"));
  for (const id of tree.ALWAYS) assert.ok(names(d.rules).includes(id));
});

test("a tiny build skips test-first; a large one adds the design rules", () => {
  const base = (size) => walk([["kind", pick("build")], ["build_size", pick(size)], ["surfaces", pick("none")]]);
  assert.ok(!names(E.derive(tree, base("tiny")).rules).includes("test-first"));
  const large = E.derive(tree, base("large"));
  assert.ok(names(large.rules).includes("two-designs"));
  assert.ok(names(large.skills).includes("architect"));
});

test("a shared follow-up question is asked once", () => {
  const a = walk([["kind", pick("design")]]);
  assert.equal(E.queue(tree, a).filter((q) => q === "surfaces").length, 1);
});

test("the gate refuses answers out of order", () => {
  assert.match(E.check(tree, {}, "summary", text("Fix the crash on start."))[0], /not part of this task|first/);
  const a = walk([["kind", pick("debug")]]);
  assert.match(E.check(tree, a, "debug_repro", pick("always"))[0], /Answer "debug_where" first/);
});

test("the gate refuses a choice that does not exist, and two picks on a one-choice question", () => {
  assert.match(E.check(tree, {}, "kind", pick("refactor"))[0], /not a choice/);
  assert.match(E.check(tree, {}, "kind", pick("debug", "build"))[0], /takes one choice/);
});

test("the gate refuses none with other choices", () => {
  const a = walk([["kind", pick("build")], ["build_size", pick("small")]]);
  assert.match(E.check(tree, a, "surfaces", pick("none", "ui")).join(" "), /"none" cannot go with other choices/);
  assert.deepEqual(E.check(tree, a, "surfaces", pick("ui", "state")), []);
});

test("the gate refuses a vague text answer", () => {
  const a = walk([["kind", pick("repro")], ["repro_where", pick("ci")]]);
  assert.match(E.check(tree, a, "summary", text("fix it"))[0], /at least 15 characters/);
});

test("changing an answer drops the questions that no longer apply", () => {
  let a = walk([["kind", pick("debug")], ["debug_where", pick("speed")]]);
  a = E.apply(tree, a, "kind", pick("review"));
  assert.ok(!("debug_where" in a));
  assert.equal(E.current(tree, a), "review_scope");
});

test("only a question stops the task with no skills", () => {
  const a = walk([["kind", pick("question")]]);
  assert.ok(E.stopOf(tree, a));
  assert.equal(E.current(tree, a), null);
});

test("the command line walks a task and writes skills.md and rules.md only at the end", () => {
  const dir = mkdtempSync(join(tmpdir(), "questionnaire-"));
  const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });
  try {
    const task = join(dir, "task");
    assert.equal(run("start", task).status, 0);
    assert.equal(run("answer", task, "summary", "--text", "too early").status, 1);
    assert.equal(run("answer", task, "kind", "build").status, 0);
    assert.equal(run("answer", task, "build_size", "small").status, 0);
    assert.equal(run("answer", task, "surfaces", "api,state").status, 0);
    assert.equal(run("answer", task, "summary", "--text", "Add a --json flag to the export command.").status, 0);
    assert.ok(!existsSync(join(task, "rules.md")), "rules.md waits for the last answer");
    const last = run("answer", task, "check", "--text", "export --json prints valid JSON and the new test passes.");
    assert.equal(last.status, 0);
    assert.match(last.stdout, /Done\./);
    assert.match(readFileSync(join(task, "skills.md"), "utf8"), /- build \(kind = build\)/);
    const rules = readFileSync(join(task, "rules.md"), "utf8");
    assert.match(rules, /Done when: export --json prints valid JSON/);
    assert.match(rules, /api-contract|Keep public names/);
    assert.equal(run("answer", task, "kind", "review").status, 0);
    assert.ok(!existsSync(join(task, "rules.md")), "a changed answer removes the stale rules");
    assert.equal(run("start", task).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
