import { QuickActions } from "@/components/QuickActions";

export const dynamic = "force-dynamic";

export default async function QuickActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const sp = await searchParams;
  const initialActionId = typeof sp.action === "string" ? sp.action : null;
  // Key by the deep-linked action so a ⌘K jump to a specific action opens it even
  // when already on this page (a same-route ?action= change won't re-run the
  // component's useState initializer otherwise). No key churn on in-page clicks.
  return <QuickActions key={initialActionId ?? "home"} initialActionId={initialActionId} />;
}
