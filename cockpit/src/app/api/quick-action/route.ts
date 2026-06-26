import { assertOllamaReady } from "@/lib/health";
import { streamTextResponse } from "@/lib/ai/streamRoute";
import { getQuickAction, missingInputs, buildMessages } from "@/lib/quickActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Run a pre-built quick action. The action id + its written-for-you prompt come
// from the shared lib, so the client can only pick a known action and fill its
// inputs; there is no free-form prompt to validate. Streams the draft for review.
export async function POST(req: Request) {
  const { actionId, inputs } = (await req.json().catch(() => ({}))) as {
    actionId?: string;
    inputs?: Record<string, string>;
  };

  const action = typeof actionId === "string" ? getQuickAction(actionId) : undefined;
  if (!action) return Response.json({ error: "Unknown action." }, { status: 400 });

  const vals = inputs && typeof inputs === "object" ? inputs : {};
  const missing = missingInputs(action, vals);
  if (missing.length > 0) {
    return Response.json({ error: `Please fill in: ${missing.join(", ")}.` }, { status: 400 });
  }

  const notReady = await assertOllamaReady();
  if (notReady) return notReady;

  return streamTextResponse({ messages: buildMessages(action, vals) });
}
