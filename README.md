# questionnaire

A skill that makes a coding agent sort out its task before it starts. It asks what kind of task this is (debug, build, design, repro, or review) and then follow-up questions for that kind. At the end it writes two files:

- `skills.md`: the skills to load for this session
- `rules.md`: the rules to follow until the task is done

The model answers, and a script decides. The script checks every answer, so the model cannot skip a question, invent a choice, or give a vague answer.

## Why

Models already know how to code. What they lack is the right instructions at the right time. Loading every skill and every rule into every session wastes context, and the model ignores most of it. The questionnaire picks only what this task needs. Because the rules are in a file, the agent can read them again after its context is compacted, instead of drifting.

## How it works

```
kind ── debug ──> debug_where ──> debug_repro ──┐
     ── build ──> build_size ───> surfaces ─────┤
     ── design ─> design_state ─> surfaces ─────┼──> summary ──> check ──> skills.md + rules.md
     ── repro ──> repro_where ──────────────────┤
     ── review ─> review_scope ─────────────────┘
     ── question ─> Stop: answer it and change nothing
```

Every question and choice lives in [`questions.js`](questions.js). A choice can add skills, add rules, ask follow-up questions, or stop the task. Three rules apply to every task: never loop on a failing step, show evidence, and keep the change small.

## The gates

The script refuses an answer, with exit code 1 and the reason, when:

- it skips ahead: the questions go in order
- it names a choice that does not exist, or picks two on a one-choice question
- it picks `none` together with other choices
- a text answer is too short to be specific

`skills.md` and `rules.md` exist only while every question is answered. Changing an earlier answer drops the follow-up questions that no longer apply, and removes the old files until the questionnaire is finished again.

## Example

A real run, for the task "the app crashes when the config file is empty":

```
$ questionnaire start .questionnaire/empty-config
kind: What kind of task is this?  (pick one)
  debug     A bug, cause unknown
  build     A change or a feature, cause known
  design    A design choice: a new flow, or two good ways to do it
  repro     Reproduce a reported problem, no fix yet
  review    Review a change
  question  Only a question about the code
Answer: questionnaire answer .questionnaire/empty-config kind <choice>

$ questionnaire answer .questionnaire/empty-config kind debug
debug_where: Where does the bug show?  (pick one or more, comma-separated)
  screen   On the screen: UI or terminal output
  network  Network or an outside service
  data     Saved data or state
  speed    It is too slow
  flaky    A test that fails only sometimes
  ci       Only in CI
Answer: questionnaire answer .questionnaire/empty-config debug_where <choice>

$ questionnaire answer .questionnaire/empty-config debug_repro always
refused: Answer "debug_where" first; the questions go in order.

$ questionnaire answer .questionnaire/empty-config debug_where data
debug_repro: Can you reproduce it now?  (pick one)
  always     Yes, every time
  sometimes  Sometimes
  no         Not yet
Answer: questionnaire answer .questionnaire/empty-config debug_repro <choice>

$ questionnaire answer .questionnaire/empty-config debug_repro always
summary: Say the task in one sentence.
Answer: questionnaire answer .questionnaire/empty-config summary --text "..."

$ questionnaire answer .questionnaire/empty-config summary --text "fix it"
refused: "summary" needs at least 15 characters. Be specific.

$ questionnaire answer .questionnaire/empty-config summary --text "The app crashes on start when the config file is empty."
check: How will you know it is done? Name the command to run or the thing you will see.
Answer: questionnaire answer .questionnaire/empty-config check --text "..."

$ questionnaire answer .questionnaire/empty-config check --text "A test that loads an empty config file passes, and the app starts with defaults."
Done. Load every skill in .questionnaire/empty-config/skills.md, and follow .questionnaire/empty-config/rules.md for the whole session.
```

`skills.md`:

```
# Skills for this session

Load each one before you start. Each line says which answer added it.

- debug (kind = debug)
- root-cause (kind = debug)
```

`rules.md`:

```
# Rules for this session

Task: The app crashes on start when the config file is empty.
Done when: A test that loads an empty config file passes, and the app starts with defaults.

Follow every rule until the task is done. Read this file again after a context compaction.

1. If the same step fails 3 times, stop and report what you tried. Never loop. (every task)
2. End with the commands you ran and what they printed. No claim without output. (every task)
3. Change only what the task needs. No drive-by refactors. (every task)
4. Reproduce the problem before you change code, and keep the command that shows it. (kind = debug)
5. Fix where the bad value starts, not where it shows. Trace it back, then forward. (kind = debug)
6. Write a test that fails before the change and passes after it. (kind = debug)
7. Write the states and transitions down, as a table or a model, before you code. (debug_where = data)
```

## Use it

1. Copy this folder into your agent's skills folder as `questionnaire`.
2. Tell your agent to start every task with it, for example with this line in your `AGENTS.md`: "Start every task with the questionnaire skill."
3. Make it yours. Edit `questions.js`: change the questions, and point the skill names at your own skills. [`examples/skills/`](examples/skills/) has two example skills, `build` and `architect`, that show what a named skill looks like.

## Files

| File | What it is |
|---|---|
| `SKILL.md` | What the agent reads: run the script, answer, then follow the two files |
| `questions.js` | The question tree, the rules, and the skills each choice adds. Edit this one |
| `lib/engine.js` | The logic: the next question, the gates, and the two files. No I/O |
| `bin/questionnaire` | The commands: `start`, `next`, `answer`, and `status` |
| `examples/skills/` | Example `build` and `architect` skills |
| `tests/` | The tests for the tree, every gate, and a full run |

Needs Node 18 or newer, and no packages. Run the tests with:

```
node --test tests/questionnaire.test.mjs
```
