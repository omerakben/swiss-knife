import { GherkinLinter } from "@/components/gherkin/GherkinLinter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function GherkinLintPage() {
  return <GherkinLinter />;
}
