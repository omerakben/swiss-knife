import { Refine } from "@/components/refine/Refine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function RefinePage() {
  return (
    <div className="max-w-3xl">
      <Refine />
    </div>
  );
}
