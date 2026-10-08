import { notFound } from "next/navigation";
import { getLabContent } from "@/lib/lab-content";
import ModelReviewLazy from "@/components/lab/ModelReviewLazy";

export const dynamic = "force-dynamic";

export default async function ModelReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ModelReviewLazy content={await getLabContent()} />;
}
