import { QuickActions } from "@/components/QuickActions";

export const dynamic = "force-dynamic";

export default async function QuickActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const sp = await searchParams;
  const initialActionId = typeof sp.action === "string" ? sp.action : null;
  return <QuickActions initialActionId={initialActionId} />;
}
