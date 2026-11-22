// The question tree. This is the file you edit to fit your own skills and rules.
//
// A question has `ask` (the text) and either `choices` or `text: true`.
//   - `many: true` lets the agent pick several choices; "none" must then be picked alone.
//   - `min` is the shortest text answer the gate accepts.
// A choice can:
//   - add skills to load (`skills`) and rules to follow (`rules`),
//   - ask follow-up questions (`then`), in order, each one once,
//   - stop the task (`stop`), when the task needs no skills at all.
"use strict";

// Every rule is short, and a reviewer can check it from the session.
const RULES = {
  "no-loop": "If the same step fails 3 times, stop and report what you tried. Never loop.",
  "evidence": "End with the commands you ran and what they printed. No claim without output.",
  "small-diff": "Change only what the task needs. No drive-by refactors.",
  "repro-first": "Reproduce the problem before you change code, and keep the command that shows it.",
  "root-cause": "Fix where the bad value starts, not where it shows. Trace it back, then forward.",
  "test-first": "Write a test that fails before the change and passes after it.",
  "flaky-count": "Run the test 20 times before and after. A flaky fix needs a count, not a feeling.",
  "measure": "Measure before and after on the same machine, and report both numbers.",
  "real-screen": "Check the screen in a real terminal or browser, not only in a unit test.",
  "untrusted": "Treat outside input as hostile: validate it, bound its size, and never log secrets.",
  "ci-exact": "Read the CI log for the exact commit, and run the same command locally.",
  "two-designs": "Write two different designs, and pick one with a measured check, not by taste.",
  "state-model": "Write the states and transitions down, as a table or a model, before you code.",
  "api-contract": "Keep public names and output stable. A breaking change ships with a migration note.",
  "read-only": "Change nothing. Every finding cites file:line.",
  "review-proof": "Each finding says how to see the problem: a command, a test, or an input.",
};

// The rules every session follows, whatever the answers.
const ALWAYS = ["no-loop", "evidence", "small-diff"];

const QUESTIONS = {
  kind: {
    ask: "What kind of task is this?",
    choices: {
      debug: { label: "A bug, cause unknown", skills: ["debug", "root-cause"], rules: ["repro-first", "root-cause", "test-first"], then: ["debug_where", "debug_repro"] },
      build: { label: "A change or a feature, cause known", skills: ["build", "test"], then: ["build_size", "surfaces"] },
      design: { label: "A design choice: a new flow, or two good ways to do it", skills: ["architect"], rules: ["two-designs"], then: ["design_state", "surfaces"] },
      repro: { label: "Reproduce a reported problem, no fix yet", skills: ["debug"], rules: ["repro-first"], then: ["repro_where"] },
      review: { label: "Review a change", skills: ["code-review"], rules: ["read-only", "review-proof"], then: ["review_scope"] },
      question: { label: "Only a question about the code", stop: "Answer it with file:line citations and change nothing. No skills to load." },
    },
  },

  debug_where: {
    ask: "Where does the bug show?",
    many: true,
    choices: {
      screen: { label: "On the screen: UI or terminal output", skills: ["ui-check"], rules: ["real-screen"] },
      network: { label: "Network or an outside service", rules: ["untrusted"] },
      data: { label: "Saved data or state", rules: ["state-model"] },
      speed: { label: "It is too slow", skills: ["profile"], rules: ["measure"] },
      flaky: { label: "A test that fails only sometimes", rules: ["flaky-count"] },
      ci: { label: "Only in CI", rules: ["ci-exact"] },
    },
  },

  debug_repro: {
    ask: "Can you reproduce it now?",
    choices: {
      always: { label: "Yes, every time" },
      sometimes: { label: "Sometimes", rules: ["flaky-count"] },
      no: { label: "Not yet", skills: ["repro-harness"] },
    },
  },

  build_size: {
    ask: "How big is the change?",
    choices: {
      tiny: { label: "Tiny: docs, a rename, or a comment" },
      small: { label: "Small: one module", rules: ["test-first"] },
      large: { label: "Large: several modules or a public API", skills: ["architect"], rules: ["test-first", "two-designs", "api-contract"] },
    },
  },

  surfaces: {
    ask: "What does the change touch?",
    many: true,
    choices: {
      ui: { label: "UI or terminal output", skills: ["ui-check"], rules: ["real-screen"] },
      api: { label: "A public API, a CLI flag, or a file format", rules: ["api-contract"] },
      state: { label: "Saved state or data", rules: ["state-model"] },
      concurrency: { label: "Threads, async work, or several writers", skills: ["stress-test"], rules: ["state-model"] },
      input: { label: "Input from outside: files, network, or users", skills: ["security-review"], rules: ["untrusted"] },
      none: { label: "None of these" },
    },
  },

  design_state: {
    ask: "Can two things change the same state at once?",
    choices: {
      yes: { label: "Yes", skills: ["stress-test"], rules: ["state-model"] },
      no: { label: "No" },
    },
  },

  repro_where: {
    ask: "Where was it reported?",
    choices: {
      local: { label: "On your machine" },
      ci: { label: "In CI", rules: ["ci-exact"] },
      user: { label: "On a user's machine only", skills: ["repro-harness"] },
    },
  },

  review_scope: {
    ask: "What is under review?",
    choices: {
      commit: { label: "One commit" },
      pr: { label: "A pull request", rules: ["ci-exact"] },
      branch: { label: "A whole branch" },
    },
  },

  summary: { ask: "Say the task in one sentence.", text: true, min: 15 },
  check: { ask: "How will you know it is done? Name the command to run or the thing you will see.", text: true, min: 15 },
};

// The first questions, and the questions every task ends with.
const START = ["kind"];
const END = ["summary", "check"];

module.exports = { RULES, ALWAYS, QUESTIONS, START, END };
