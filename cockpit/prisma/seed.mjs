// Idempotent seed for builtin templates (run: npm run db:seed).
// Upserts on `slug` so re-running refreshes wording without duplicating.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Reusable variable definitions.
const topic = { name: "topic", label: "Topic", type: "textarea", required: true };
const text = { name: "text", label: "Text", type: "textarea", required: true };
const count = {
  name: "count",
  label: "How many",
  type: "select",
  options: ["3", "5", "7"],
  default: "5",
};
const tone = {
  name: "tone",
  label: "Tone",
  type: "select",
  options: ["formal", "friendly", "concise", "persuasive"],
  default: "friendly",
};

// Brainstorming technique modes (kind = "technique").
const techniques = [
  {
    slug: "technique-expand",
    category: "expand",
    name: "Expand",
    description: "Generate many directions from one topic.",
    vars: [topic, count],
    body:
      "Brainstorm and expand on this topic:\n\n{{topic}}\n\nGenerate {{count}} distinct ideas or directions. For each, give a short title and a one-sentence rationale.",
  },
  {
    slug: "technique-alternatives",
    category: "alternatives",
    name: "Alternatives",
    description: "Find genuinely different options.",
    vars: [topic, count],
    body:
      "Propose {{count}} genuinely different alternatives to the following idea or approach:\n\n{{topic}}\n\nFor each alternative, note its single biggest trade-off.",
  },
  {
    slug: "technique-premortem",
    category: "premortem",
    name: "Premortem",
    description: "Imagine it failed; find the risks early.",
    vars: [topic],
    body:
      "Run a premortem on the following plan or idea:\n\n{{topic}}\n\nAssume it has failed badly. List the most likely failure modes, the early warning signs of each, and one preventive action per failure mode.",
  },
  {
    slug: "technique-proscons",
    category: "proscons",
    name: "Pros & cons",
    description: "A balanced weighing with a recommendation.",
    vars: [topic],
    body:
      "Give a balanced analysis of the following:\n\n{{topic}}\n\nList the strongest pros and the strongest cons, then end with a one-line recommendation.",
  },
  {
    slug: "technique-scamper",
    category: "scamper",
    name: "SCAMPER",
    description: "Structured idea generation via SCAMPER.",
    vars: [topic],
    body:
      "Apply the SCAMPER technique to:\n\n{{topic}}\n\nGive concrete ideas under each heading: Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, Reverse.",
  },
  {
    slug: "technique-sharpen",
    category: "sharpen",
    name: "Sharpen (Socratic)",
    description: "Ask the high-leverage questions first.",
    vars: [topic, count],
    body:
      "Act as a sharp thinking partner. Before giving any solution, ask me the {{count}} highest-leverage clarifying questions about:\n\n{{topic}}\n\nThen propose a refined one-sentence problem statement and the single best first step.",
  },
];

// Starter prompt-library templates (kind = "prompt").
const promptTemplates = [
  {
    slug: "template-summarize-bullets",
    category: "summarize",
    name: "Summarize to bullets",
    description: "Condense text into scannable bullets.",
    vars: [count, text],
    body: "Summarize the following into {{count}} concise, scannable bullet points:\n\n{{text}}",
  },
  {
    slug: "template-rewrite-tone",
    category: "rewrite",
    name: "Rewrite in a tone",
    description: "Restyle text while keeping meaning.",
    vars: [tone, text],
    body:
      "Rewrite the following in a {{tone}} tone, preserving the meaning and key details:\n\n{{text}}",
  },
  {
    slug: "template-eli5",
    category: "explain",
    name: "Explain simply",
    description: "Plain-language explanation, no jargon.",
    vars: [text],
    body:
      "Explain the following clearly and simply, as if to a smart 12-year-old, avoiding jargon:\n\n{{text}}",
  },
];

function row(t, kind) {
  return {
    slug: t.slug,
    kind,
    category: t.category,
    name: t.name,
    description: t.description,
    body: t.body,
    variables: JSON.stringify(t.vars),
    builtin: true,
  };
}

async function main() {
  const all = [
    ...techniques.map((t) => row(t, "technique")),
    ...promptTemplates.map((t) => row(t, "prompt")),
  ];
  for (const r of all) {
    await prisma.template.upsert({ where: { slug: r.slug }, update: r, create: r });
  }
  const techniqueCount = await prisma.template.count({ where: { kind: "technique" } });
  const promptCount = await prisma.template.count({ where: { kind: "prompt" } });
  console.log(`Seeded builtins: ${techniqueCount} techniques, ${promptCount} prompt templates.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
