// Two reference packs that double as living documentation and as validator
// fixtures (manifest.test.ts asserts both pass with zero errors). They show the
// two ends of the v1 ladder: Small Business Ops is a pure L0 content pack (the
// first mass-market pack), QA and Product Ops is an L1 pack that surfaces routes
// and leans on deterministic gates that already exist in this repo (the first
// professional pack). Neither requests network, sending, code, or autonomy.

import { defaultPermissions, type PluginManifest } from "./manifest";

// First mass-market pack. Content only (templates, facts, task seeds) so it
// installs by seeding alone, no new routes or code. Proves the app can move
// beyond developers.
export const smallBusinessOpsPack: PluginManifest = {
  slug: "small-business-ops",
  name: "Small Business Ops",
  version: "0.1.0",
  description:
    "Run day-to-day admin without hiring an assistant: turn notes into tasks and follow-ups, draft proposals and SOPs, and review the week.",
  audience: "small-business",
  industry: "small business operations",
  maturity: "L0",
  capabilities: [
    "Turn meeting notes into tasks and a follow-up draft",
    "Draft a proposal from a rough brief",
    "Draft a follow-up email in your tone",
    "Build a standard operating procedure from rough steps",
    "Prepare a weekly business review",
    "Organize receipts and invoices into a checklist",
  ],
  requiredModels: ["gemma4:e4b"],
  templates: [
    {
      slug: "sbo-meeting-notes-to-tasks",
      kind: "prompt",
      category: "planning",
      name: "Meeting notes to tasks",
      description: "Extract action items, owners, and dates from rough meeting notes.",
      body: "Read these meeting notes and list the action items as tasks. For each: a short title, the owner if named, and a due date if stated. Keep it to what the notes actually say.\n\nNotes:\n{{notes}}",
      variables: JSON.stringify([{ name: "notes", label: "Meeting notes", type: "textarea" }]),
    },
    {
      slug: "sbo-follow-up-email",
      kind: "prompt",
      category: "email",
      name: "Follow-up email",
      description: "Draft a short, polite follow-up after a meeting or quote.",
      body: "Write a short, friendly follow-up email to {{recipient}} about {{topic}}. Keep it under 120 words, end with one clear next step, and do not invent details.",
      variables: JSON.stringify([
        { name: "recipient", label: "Recipient", type: "text" },
        { name: "topic", label: "Topic", type: "text" },
      ]),
    },
    {
      slug: "sbo-weekly-review",
      kind: "prompt",
      category: "planning",
      name: "Weekly business review",
      description: "Summarize the week into wins, open loops, and next week's focus.",
      body: "From these notes and tasks, write a weekly review with three short sections: Wins, Open loops, Focus next week. Be concrete and brief.\n\n{{input}}",
      variables: JSON.stringify([{ name: "input", label: "This week's notes and tasks", type: "textarea" }]),
    },
    {
      slug: "sbo-proposal-writer",
      kind: "prompt",
      category: "proposal",
      name: "Proposal writer",
      description: "Draft a client proposal from a short brief.",
      body: "Write a short, professional proposal for {{client}}. Scope of work: {{scope}}. Use sections: Overview, What's included, Timeline, and Price. Keep it concise and concrete, and do not invent details that aren't in the brief. Budget or rate guidance: {{budget}}.",
      variables: JSON.stringify([
        { name: "client", label: "Client", type: "text" },
        { name: "scope", label: "Scope of work", type: "textarea" },
        { name: "budget", label: "Budget or rate (optional)", type: "text" },
      ]),
    },
    {
      slug: "sbo-sop-builder",
      kind: "prompt",
      category: "operations",
      name: "SOP builder",
      description: "Turn rough steps into a clean standard operating procedure.",
      body: "Turn these rough steps into a clear standard operating procedure for \"{{task}}\". Number the steps, make each one a single action, add a short Purpose line at the top and a Checklist at the end, and keep only what the notes contain.\n\nSteps:\n{{steps}}",
      variables: JSON.stringify([
        { name: "task", label: "Task or process name", type: "text" },
        { name: "steps", label: "Rough steps", type: "textarea" },
      ]),
    },
    {
      slug: "sbo-receipt-organizer",
      kind: "prompt",
      category: "finance",
      name: "Receipt and invoice organizer",
      description: "Pull the key fields out of a receipt or invoice into one tidy record.",
      body: "Read this receipt or invoice text and return one tidy record with: vendor, date, total amount, and a spending category (for example supplies, travel, software, meals). If a field is missing, write \"unknown\", and do not guess amounts.\n\n{{text}}",
      variables: JSON.stringify([{ name: "text", label: "Receipt or invoice text", type: "textarea" }]),
    },
  ],
  memoryFacts: [
    {
      sourceKey: "sbo-fact-tone",
      key: "Writing tone",
      value: "Client messages stay warm, concise, and direct. No corporate filler.",
      category: "preference",
    },
    {
      sourceKey: "sbo-fact-review-cadence",
      key: "Review cadence",
      value: "A weekly business review runs every Friday afternoon.",
      category: "workflow",
    },
  ],
  taskSeeds: [
    { sourceKey: "sbo-task-setup-project", title: "Create a business project and set the working week", status: "todo" },
    { sourceKey: "sbo-task-first-review", title: "Run the first weekly business review", status: "todo" },
  ],
  knowledgeSources: [],
  gates: [],
  routes: [],
  mcpTools: [],
  permissions: defaultPermissions(),
  setupChecks: [
    "Local model gemma4:e4b is installed.",
    "At least one business project exists.",
    "No email is sent automatically; every draft is reviewed before use.",
  ],
};

// First professional pack. L1: it surfaces existing cockpit routes and relies on
// deterministic gates already shipped in this repo (gherkinLint, rubric,
// evalCases, codeSmells). It requests no extra permissions.
export const qaProductOpsPack: PluginManifest = {
  slug: "qa-product-ops",
  name: "QA and Product Ops",
  version: "0.1.0",
  description:
    "Turn requirements into reliable acceptance artifacts: story to Gherkin to lint to rubric, plus bug reports, eval cases, and a release readiness checklist. The quality tier (gemma4:12b) can be set per tool for more rigor.",
  audience: "professional",
  industry: "software QA and product operations",
  maturity: "L1",
  capabilities: [
    "Turn a story into acceptance criteria and Gherkin",
    "Lint Gherkin for BDD hygiene",
    "Turn a rough note into a structured bug report",
    "Design a weighted, gated eval rubric",
    "Generate coverage-checked eval cases",
    "Produce a release readiness checklist",
  ],
  requiredModels: ["gemma4:e4b"],
  templates: [
    {
      slug: "qpo-release-readiness",
      kind: "prompt",
      name: "Release readiness checklist",
      description: "Draft a pre-release checklist from the change set and known risks.",
      body: "Draft a release readiness checklist for this change. Cover: acceptance criteria met, tests run, known risks, rollback plan, and sign-off. Keep each item one line.\n\nChange summary:\n{{summary}}",
      variables: JSON.stringify([{ name: "summary", label: "Change summary", type: "textarea" }]),
    },
  ],
  memoryFacts: [
    {
      sourceKey: "qpo-fact-gate-first",
      key: "Quality bar",
      value: "Every AI draft that feeds durable state passes a deterministic gate (lint, score, or schema) before it is saved.",
      category: "standard",
    },
  ],
  taskSeeds: [
    { sourceKey: "qpo-task-first-pipeline", title: "Run a story through the QA pipeline (Gherkin, lint, rubric)", status: "todo" },
  ],
  knowledgeSources: [],
  gates: ["gherkinLint", "rubric", "evalCases"],
  routes: [
    "/tools/qa-pipeline",
    "/tools/gherkin-lint",
    "/tools/bug-report",
    "/tools/rubric-designer",
    "/tools/eval-cases",
  ],
  mcpTools: [],
  permissions: defaultPermissions(),
  setupChecks: [
    "Local model gemma4:e4b is installed (gemma4:12b optional for the QA tier).",
    "A project exists to scope rubrics and golden cases.",
  ],
};

// Second mass-market pack. Content only (L0): the everyday paperwork of running
// a household and family. Plain-language helpers only — it never gives medical,
// legal, financial, or tax advice (the industry string stays clear of the
// high-stakes keywords so the validator's hard gate doesn't apply).
export const householdFamilyPack: PluginManifest = {
  slug: "household-family",
  name: "Household & Family",
  version: "0.1.0",
  description:
    "The everyday admin of home and family: messages to school and services, the week's plan, meals and groceries, appointments, and turning confusing letters into plain language.",
  audience: "household",
  industry: "household and family life",
  maturity: "L0",
  capabilities: [
    "Write a clear message to a teacher, school, or service",
    "Turn a chaotic week into a simple family plan",
    "Make a few days of meals and a grocery list",
    "Pull appointments and due dates out of rough notes",
    "Explain a confusing letter or form in plain language",
  ],
  requiredModels: ["gemma4:e4b"],
  templates: [
    {
      slug: "hf-school-message",
      kind: "prompt",
      category: "email",
      name: "Message to school or a service",
      description: "A short, polite message to a teacher, school, doctor's office, or any service.",
      body: "Write a short, polite message to {{recipient}}. It is about: {{about}}. Keep it clear and friendly, and do not invent details.",
      variables: JSON.stringify([
        { name: "recipient", label: "Who is it to?", type: "text" },
        { name: "about", label: "What is it about?", type: "textarea" },
      ]),
    },
    {
      slug: "hf-family-week",
      kind: "prompt",
      category: "planning",
      name: "Plan the family week",
      description: "Turn a brain-dump of everything going on into a simple day-by-day plan.",
      body: "Turn these notes about the week into a simple, realistic day-by-day plan for the family. Group things by day, keep each item short, and flag anything that clashes. Only use what the notes say.\n\nNotes:\n{{notes}}",
      variables: JSON.stringify([{ name: "notes", label: "Everything going on this week", type: "textarea" }]),
    },
    {
      slug: "hf-meal-plan",
      kind: "prompt",
      category: "planning",
      name: "Meal plan and grocery list",
      description: "A few days of simple meals plus a tidy grocery list.",
      body: "Make a simple meal plan for {{days}} days for {{people}}. Then give a grocery list grouped by aisle (produce, dairy, pantry, etc.). Keep meals easy and budget-friendly. Notes or preferences: {{notes}}.",
      variables: JSON.stringify([
        { name: "days", label: "How many days?", type: "text" },
        { name: "people", label: "Who for? (e.g. 2 adults, 2 kids)", type: "text" },
        { name: "notes", label: "Preferences or things to avoid (optional)", type: "text" },
      ]),
    },
    {
      slug: "hf-appointments",
      kind: "prompt",
      category: "planning",
      name: "Appointments and reminders",
      description: "Pull dates, times, and what to bring out of rough notes.",
      body: "Read these notes and list the appointments and reminders. For each: what it is, the date and time if stated, and anything to bring or do beforehand. Only use what the notes say; mark missing details \"unknown\".\n\nNotes:\n{{notes}}",
      variables: JSON.stringify([{ name: "notes", label: "Notes about appointments", type: "textarea" }]),
    },
    {
      slug: "hf-explain-letter",
      kind: "prompt",
      category: "family",
      name: "Explain this in plain language",
      description: "Turn a confusing letter, form, or notice into clear everyday language.",
      body: "Explain the following in plain, everyday language, as if to a busy friend. Say what it is, what it's asking, and what (if anything) I need to do and by when. Do not give legal, medical, tax, or financial advice — just explain what it says.\n\n{{text}}",
      variables: JSON.stringify([{ name: "text", label: "The letter, form, or notice", type: "textarea" }]),
    },
  ],
  memoryFacts: [
    {
      sourceKey: "hf-fact-tone",
      key: "Family tone",
      value: "Messages to school, family, and services stay warm, clear, and brief.",
      category: "preference",
    },
    {
      sourceKey: "hf-fact-rhythm",
      key: "Weekly rhythm",
      value: "Groceries on the weekend; the family week gets planned on Sunday evening.",
      category: "workflow",
    },
  ],
  taskSeeds: [
    { sourceKey: "hf-task-appointments", title: "Add this week's appointments and due dates", status: "todo" },
    { sourceKey: "hf-task-week-plan", title: "Plan the family week", status: "todo" },
  ],
  knowledgeSources: [],
  gates: [],
  routes: [],
  mcpTools: [],
  permissions: defaultPermissions(),
  setupChecks: [
    "Local model gemma4:e4b is installed.",
    "Plain-language helper only — it does not give medical, legal, tax, or financial advice.",
    "No message is sent automatically; every draft is reviewed before use.",
  ],
};

/** Reference packs shipped with the app, keyed by slug. */
export const EXAMPLE_PACKS: PluginManifest[] = [smallBusinessOpsPack, qaProductOpsPack, householdFamilyPack];
