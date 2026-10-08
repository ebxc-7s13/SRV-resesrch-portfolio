"use client";
import nextDynamic from "next/dynamic";
import type { LabContent } from "@/lib/lab-devices";

// Development-only viewer pulls in three/lab chunks: keep it out of the
// static import graph so production builds stay lean (the route 404s in
// production via middleware anyway). `ssr: false` must live in a Client
// Component, hence this wrapper.
const ModelReview = nextDynamic(() => import("./ModelReview"), {
  ssr: false,
  loading: () => <main style={{ padding: 24 }}>Loading model review…</main>,
});

export default function ModelReviewLazy({ content }: { content: LabContent }) {
  return <ModelReview content={content} />;
}
