---
name: questionnaire
description: "Start every coding task here. Answer a short questionnaire about the task, and it gives you the skills to load and the rules to follow for the whole session. Use at the start of any debug, build, design, repro, or review task."
---

# Questionnaire

Before you change anything, answer the questionnaire. It decides which skills and rules this task needs.

1. Pick a run folder for this task, such as `.questionnaire/<short-task-name>`, and run `node <this skill's folder>/bin/questionnaire start <run-folder>`.
2. Each step prints one question and the exact command to answer it. Read the task and the code you need first. Answer what is true, not what is easy.
3. If the script prints `refused:`, read the reason, fix the answer, and run it again. Never skip a question.
4. When it prints `Done.`, read `skills.md` in the run folder and load every skill it names. Then read `rules.md`.
5. Follow `rules.md` until the task is done. Read it again after a context compaction.
6. If you learn the task is different, answer the changed question again with the same command. The script drops the questions that no longer apply, and writes both files again when you finish.
7. If it prints `Stop:`, do what it says and load no skills.
