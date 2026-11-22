// Pure logic for the questionnaire: it reads the tree and the answers and returns values or text.
// It touches no files and prints nothing, so tests can check every gate.
//
// `answers` maps a question id to { picks: ["id", ...] } or { text: "..." }.
"use strict";

// The questions this task asks, in order: the start questions, the follow-ups of each pick, then the end.
function queue(tree, answers) {
  const order = [];
  const visit = (qid) => {
    if (order.includes(qid)) return;
    order.push(qid);
    const answer = answers[qid];
    const question = tree.QUESTIONS[qid];
    if (!answer || !answer.picks || !question.choices) return;
    for (const pick of answer.picks) {
      for (const next of question.choices[pick].then || []) visit(next);
    }
  };
  tree.START.forEach(visit);
  if (stopOf(tree, answers)) return order;
  tree.END.forEach(visit);
  return order;
}

// The first pick that stops the task, such as "only a question".
function stopOf(tree, answers) {
  for (const [qid, answer] of Object.entries(answers)) {
    const question = tree.QUESTIONS[qid];
    for (const pick of (answer && answer.picks) || []) {
      const choice = question && question.choices && question.choices[pick];
      if (choice && choice.stop) return { qid, pick, text: choice.stop };
    }
  }
  return null;
}

// The next question to answer, or null when the questionnaire is done.
function current(tree, answers) {
  if (stopOf(tree, answers)) return null;
  return queue(tree, answers).find((qid) => !(qid in answers)) || null;
}

// The problems with an answer. An empty list means the gate accepts it.
function check(tree, answers, qid, answer) {
  const question = tree.QUESTIONS[qid];
  if (!question) return [`There is no question "${qid}".`];
  const asked = queue(tree, answers);
  const next = current(tree, answers);
  if (!asked.includes(qid)) return [`"${qid}" is not part of this task. Answer "${next}" next.`];
  if (!(qid in answers) && qid !== next) return [`Answer "${next}" first; the questions go in order.`];
  if (question.text) {
    const text = (answer.text || "").trim();
    if (!text) return [`"${qid}" takes a text answer: --text "..."`];
    if (text.length < (question.min || 1)) return [`"${qid}" needs at least ${question.min} characters. Be specific.`];
    return [];
  }
  const picks = answer.picks || [];
  if (picks.length === 0) return [`"${qid}" takes one of: ${Object.keys(question.choices).join(", ")}.`];
  const problems = picks
    .filter((pick) => !(pick in question.choices))
    .map((pick) => `"${pick}" is not a choice of "${qid}". Choose from: ${Object.keys(question.choices).join(", ")}.`);
  if (!question.many && picks.length > 1) problems.push(`"${qid}" takes one choice, not ${picks.length}.`);
  if (question.many && picks.includes("none") && picks.length > 1) problems.push(`"none" cannot go with other choices.`);
  if (new Set(picks).size !== picks.length) problems.push(`Each choice may appear once.`);
  return problems;
}

// The answers after this one is saved. A changed answer drops the answers to questions the task no longer asks.
function apply(tree, answers, qid, answer) {
  const next = { ...answers, [qid]: answer };
  const asked = queue(tree, next);
  for (const id of Object.keys(next)) if (!asked.includes(id)) delete next[id];
  return next;
}

// The skills to load and the rules to follow, each with the answer that added it.
function derive(tree, answers) {
  const skills = new Map();
  const rules = new Map();
  for (const id of tree.ALWAYS) rules.set(id, "every task");
  for (const qid of queue(tree, answers)) {
    const answer = answers[qid];
    const question = tree.QUESTIONS[qid];
    if (!answer || !answer.picks) continue;
    for (const pick of answer.picks) {
      const choice = question.choices[pick];
      const from = `${qid} = ${pick}`;
      for (const skill of choice.skills || []) if (!skills.has(skill)) skills.set(skill, from);
      for (const rule of choice.rules || []) if (!rules.has(rule)) rules.set(rule, from);
    }
  }
  return {
    skills: [...skills].map(([name, from]) => ({ name, from })),
    rules: [...rules].map(([id, from]) => ({ id, text: tree.RULES[id], from })),
  };
}

function renderQuestion(tree, qid, command) {
  const question = tree.QUESTIONS[qid];
  const lines = [`${qid}: ${question.ask}`];
  if (question.text) {
    lines.push(`Answer: ${command} ${qid} --text "..."`);
    return lines.join("\n");
  }
  lines[0] += question.many ? "  (pick one or more, comma-separated)" : "  (pick one)";
  const width = Math.max(...Object.keys(question.choices).map((id) => id.length));
  for (const [id, choice] of Object.entries(question.choices)) lines.push(`  ${id.padEnd(width)}  ${choice.label}`);
  lines.push(`Answer: ${command} ${qid} <choice>`);
  return lines.join("\n");
}

function renderSkills(tree, answers) {
  const { skills } = derive(tree, answers);
  const lines = ["# Skills for this session", "", "Load each one before you start. Each line says which answer added it.", ""];
  if (skills.length === 0) lines.push("- none");
  for (const s of skills) lines.push(`- ${s.name} (${s.from})`);
  return lines.join("\n") + "\n";
}

function renderRules(tree, answers) {
  const { rules } = derive(tree, answers);
  const lines = ["# Rules for this session", ""];
  if (answers.summary) lines.push(`Task: ${answers.summary.text}`);
  if (answers.check) lines.push(`Done when: ${answers.check.text}`);
  lines.push("", "Follow every rule until the task is done. Read this file again after a context compaction.", "");
  rules.forEach((r, i) => lines.push(`${i + 1}. ${r.text} (${r.from})`));
  return lines.join("\n") + "\n";
}

// Problems in the tree itself: a missing follow-up question or rule, or an empty choice list.
function validate(tree) {
  const problems = [];
  for (const id of [...tree.START, ...tree.END]) if (!tree.QUESTIONS[id]) problems.push(`START or END names a missing question "${id}".`);
  for (const id of tree.ALWAYS) if (!tree.RULES[id]) problems.push(`ALWAYS names a missing rule "${id}".`);
  for (const [qid, question] of Object.entries(tree.QUESTIONS)) {
    if (!question.ask) problems.push(`"${qid}" has no ask text.`);
    if (question.text) continue;
    if (!question.choices || Object.keys(question.choices).length === 0) problems.push(`"${qid}" has no choices.`);
    for (const [pick, choice] of Object.entries(question.choices || {})) {
      for (const next of choice.then || []) if (!tree.QUESTIONS[next]) problems.push(`${qid}.${pick} asks a missing question "${next}".`);
      for (const rule of choice.rules || []) if (!tree.RULES[rule]) problems.push(`${qid}.${pick} names a missing rule "${rule}".`);
    }
  }
  return problems;
}

module.exports = { queue, stopOf, current, check, apply, derive, renderQuestion, renderSkills, renderRules, validate };
