import Link from "next/link";

const tools = [
  { href: "/", label: "Dashboard" },
  { href: "/tools/prompt-optimizer", label: "Prompt Optimizer" },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white p-4">
      <div className="mb-6 text-lg font-semibold">🔧 Swiss Knife</div>
      <nav className="flex flex-col gap-1">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            {t.label}
          </Link>
        ))}
        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noreferrer"
          className="mt-2 rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100"
        >
          Open WebUI ↗
        </a>
      </nav>
      <div className="mt-8 text-xs text-neutral-400">
        Powered by local Gemma 4 12B
      </div>
    </aside>
  );
}
