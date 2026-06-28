// Idempotent loader for a local project pack (run: npm run seed:local-pack).
// The pack content lives under cockpit/projects/<pack>/pack/ which is GITIGNORED
// (it can hold private, customer, or domain-specific data). This loader is safe to commit:
// it upserts facts/prompts by sourceKey and templates by slug, so re-running refreshes
// wording without duplicating, and it skips cleanly when no pack is present.
//
// Pack location: defaults to ../projects/local-pack/pack relative to this file; override
// with HAVEN_DESK_PACK_DIR or PROJECT_PACK_DIR (absolute path or relative to cockpit/).
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

function packDirUrl() {
  const packDir = process.env.HAVEN_DESK_PACK_DIR ?? process.env.PROJECT_PACK_DIR;
  if (packDir) {
    return pathToFileURL(resolve(process.cwd(), packDir) + "/");
  }
  return new URL("../projects/local-pack/pack/", import.meta.url);
}

async function loadPack() {
  const dir = packDirUrl();
  const contentUrl = new URL("content.mjs", dir);
  try {
    await access(contentUrl);
  } catch (e) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
  const content = await import(contentUrl.href);

  // Optional generated tasks file (Phase F). Absent until the tracker is extracted.
  let tasks = [];
  try {
    tasks = JSON.parse(await readFile(new URL("tasks.json", dir), "utf8"));
  } catch (e) {
    if (e?.code !== "ENOENT") throw e;
  }
  return { ...content, tasks };
}

const STATUSES = new Set(["todo", "doing", "done"]);
const PRIORITIES = new Set(["low", "medium", "high"]);

async function main() {
  const pack = await loadPack();
  if (!pack) {
    console.log(
      "No local project pack found. Create cockpit/projects/local-pack/pack/content.mjs " +
        "or set HAVEN_DESK_PACK_DIR=projects/<pack>/pack. Nothing to seed."
    );
    return;
  }

  // 1) Project anchor (no unique name column → find-or-create, then refresh description/owuiUrl).
  const p = pack.project;
  let project = await prisma.project.findFirst({ where: { name: p.name } });
  if (project) {
    project = await prisma.project.update({
      where: { id: project.id },
      data: { description: p.description, ...(p.owuiUrl ? { owuiUrl: p.owuiUrl } : {}) },
    });
  } else {
    project = await prisma.project.create({ data: p });
  }
  const projectId = project.id;

  // 2) Memory facts — upsert by sourceKey.
  for (const f of pack.facts ?? []) {
    const data = {
      key: f.key ?? null,
      value: f.value,
      pinned: Boolean(f.pinned),
      source: "manual",
      status: "active",
      sourceKey: f.sourceKey,
      projectId,
    };
    await prisma.memoryFact.upsert({ where: { sourceKey: f.sourceKey }, update: data, create: data });
  }

  // 3) Templates — upsert by slug.
  for (const t of pack.templates ?? []) {
    const data = {
      slug: t.slug,
      kind: t.kind,
      category: t.category ?? null,
      name: t.name,
      description: t.description ?? null,
      body: t.body,
      variables: JSON.stringify(t.variables ?? []),
      builtin: true,
      projectId,
    };
    await prisma.template.upsert({ where: { slug: t.slug }, update: data, create: data });
  }

  // 4) Prompt-library entries — upsert by sourceKey.
  for (const pr of pack.prompts ?? []) {
    const data = {
      title: pr.title,
      original: pr.original,
      optimized: pr.optimized ?? null,
      tags: pr.tags ?? null,
      source: "library",
      sourceKey: pr.sourceKey,
      projectId,
    };
    await prisma.prompt.upsert({ where: { sourceKey: pr.sourceKey }, update: data, create: data });
  }

  // 5) Tasks (training tracker) — upsert by sourceKey. Empty until Phase F extraction.
  let taskOrder = 0;
  for (const tk of pack.tasks ?? []) {
    const status = STATUSES.has(tk.status) ? tk.status : "todo";
    const data = {
      title: tk.title,
      notes: tk.notes ?? null,
      status,
      priority: PRIORITIES.has(tk.priority) ? tk.priority : "medium",
      module: tk.module ?? null,
      order: typeof tk.order === "number" ? tk.order : taskOrder++,
      completedAt: tk.completedAt ? new Date(tk.completedAt) : status === "done" ? new Date() : null,
      sourceKey: tk.sourceKey,
      projectId,
    };
    await prisma.task.upsert({ where: { sourceKey: tk.sourceKey }, update: data, create: data });
  }

  const counts = {
    facts: await prisma.memoryFact.count({ where: { projectId } }),
    templates: await prisma.template.count({ where: { projectId } }),
    prompts: await prisma.prompt.count({ where: { projectId } }),
    tasks: await prisma.task.count({ where: { projectId } }),
  };
  console.log(
    `Seeded local project pack into project "${project.name}" (${projectId}): ` +
      `${counts.facts} facts, ${counts.templates} templates, ${counts.prompts} prompts, ${counts.tasks} tasks.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
