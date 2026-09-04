import { ScopeCanvas } from "@/components/buyer/scope-canvas";

export default function ScopePage({ params }: { params: Promise<{ scopeRef: string }> }) {
  return <ScopeCanvas scopeRefPromise={params} />;
}
