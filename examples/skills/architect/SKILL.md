---
name: architect
description: "Choose a design before any code: write two real options, prove the risky claim of each with a small test, and pick by the result. Use when the questionnaire names it."
---

# Architect

`rules.md` from the questionnaire wins over this skill when they disagree.

1. **Write the problem in three lines:** what must always hold, what may change, and what must not change.
2. **Map the area.** List the modules, the data each one owns, and the calls between them.
3. **Write two designs that differ in a real way,** not one good and one straw man. For each: the data and its owner, the flow, and what happens when a step fails or two things run at once.
4. **Name the one claim each design stands or falls on,** such as "two writers never lose an update" or "a restart loses no work".
5. **Prove each claim** with the cheapest real check: a spike, a test, a benchmark, or a model of the states. Keep the commands and the numbers.
6. **Pick by the result.** Say in one line why the other design lost.
7. **Hand off a plan** that build can follow: the files, the functions, and the tests to write first.

When the numbers cannot decide, stop and ask the person, with both designs and their results.
