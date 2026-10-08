"use client";

import { CmsList } from "@/components/AdminCms";

const projectFields = [
  { key: "title", label: "Title", type: "text" as const, required: true },
  {
    key: "slug",
    label: "Slug",
    type: "text" as const,
    helpText: "Auto-generated from title if left empty",
  },
  {
    key: "research_problem",
    label: "Research Problem",
    type: "textarea" as const,
    required: true,
    rows: 4,
  },
  {
    key: "motivation",
    label: "Motivation",
    type: "textarea" as const,
    required: true,
    rows: 3,
  },
  {
    key: "approach",
    label: "Approach",
    type: "textarea" as const,
    required: true,
    rows: 3,
  },
  {
    key: "methodology",
    label: "Methodology",
    type: "textarea" as const,
    rows: 3,
  },
  {
    key: "experimental_setup",
    label: "Experimental Setup",
    type: "textarea" as const,
    rows: 3,
  },
  { key: "hardware", label: "Hardware", type: "textarea" as const, rows: 2 },
  {
    key: "data_acquisition",
    label: "Data Acquisition",
    type: "textarea" as const,
    rows: 2,
  },
  {
    key: "computational_method",
    label: "Computational Method",
    type: "textarea" as const,
    rows: 3,
  },
  {
    key: "results",
    label: "Results",
    type: "textarea" as const,
    required: true,
    rows: 4,
  },
  {
    key: "key_contribution",
    label: "Key Contribution",
    type: "textarea" as const,
    required: true,
    rows: 3,
  },
  {
    key: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { value: "completed", label: "Completed" },
      { value: "ongoing", label: "Ongoing" },
      { value: "under_review", label: "Under Review" },
      { value: "filed", label: "Filed" },
    ],
  },
  { key: "featured", label: "Featured", type: "checkbox" as const },
  { key: "sort_order", label: "Sort Order", type: "number" as const },
  {
    key: "cover_image",
    label: "Cover Image Path",
    type: "text" as const,
    placeholder: "/research/oral-cancer/fig6_workflow_overview.png",
  },
];

const projectColumns = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "sort_order", label: "Order" },
];

export default function AdminProjectsPage() {
  return (
    <CmsList
      title="Research Projects"
      apiBase="/api/admin/projects"
      fields={projectFields}
      columns={projectColumns}
    />
  );
}
