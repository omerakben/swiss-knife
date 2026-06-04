import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let recent: { id: string; title: string }[] = [];
  try {
    recent = await prisma.prompt.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true },
    });
  } catch {
    // DB not migrated yet — fine on first boot
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Welcome back, Ozzy</h1>
      <p className="mt-1 text-neutral-500">
        Your local AI cockpit. Everything runs on this machine.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <Link
          href="/tools/prompt-optimizer"
          className="rounded-xl border border-neutral-200 bg-white p-5 hover:shadow-sm"
        >
          <div className="text-base font-medium">✨ Prompt Optimizer</div>
          <div className="mt-1 text-sm text-neutral-500">
            Clean up and save reusable prompts.
          </div>
        </Link>
        <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-neutral-400">
          <div className="text-base font-medium">📥 Coming next</div>
          <div className="mt-1 text-sm">
            Email writer · Todo · Kanban · Knowledge base
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-neutral-500">Recent prompts</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">
            None yet — optimize your first prompt.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {recent.map((p) => (
              <li key={p.id} className="text-sm text-neutral-700">
                • {p.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
