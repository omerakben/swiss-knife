import { ApiContractDesigner } from "@/components/api-contract/ApiContractDesigner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ApiContractPage() {
  return <ApiContractDesigner />;
}
