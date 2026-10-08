"use client";

import { CmsList } from "@/components/AdminCms";

const patentFields = [
  { key: "title", label: "Title", type: "text" as const, required: true },
  {
    key: "inventors",
    label: "Inventors",
    type: "text" as const,
    required: true,
  },
  {
    key: "applicant",
    label: "Applicant",
    type: "text" as const,
    required: true,
  },
  {
    key: "status",
    label: "Status",
    type: "select" as const,
    required: true,
    options: [
      { value: "granted", label: "Granted" },
      { value: "filed", label: "Filed" },
      { value: "pending", label: "Pending" },
      { value: "search_report", label: "Search Report" },
    ],
  },
  {
    key: "description",
    label: "Full Description",
    type: "textarea" as const,
    required: true,
    rows: 8,
    helpText:
      "Comprehensive technology description including system details, motivation, and application",
  },
  {
    key: "innovation",
    label: "Innovation & Technical Contribution",
    type: "textarea" as const,
    required: true,
    rows: 6,
    helpText:
      "Detailed innovation description and main technical contributions",
  },
  { key: "research_area", label: "Research Area", type: "text" as const },
  { key: "sort_order", label: "Sort Order", type: "number" as const },
];

const patentColumns = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
];

export default function AdminPatentsPage() {
  return (
    <CmsList
      title="Patents"
      apiBase="/api/admin/patents"
      fields={patentFields}
      columns={patentColumns}
    />
  );
}
