import { EvalCaseGenerator } from "@/components/eval/EvalCaseGenerator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function EvalCasesPage() {
  return <EvalCaseGenerator />;
}
