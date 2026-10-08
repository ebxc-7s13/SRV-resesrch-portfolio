"use client";
import { CmsList } from "@/components/AdminCms";
export default function Publications() {
  return (
    <CmsList
      title="Publications"
      apiBase="/api/admin/publications"
      columns={[
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "journal", label: "Journal" },
      ]}
      fields={[
        { key: "title", label: "Title", type: "text", required: true },
        { key: "authors", label: "Authors", type: "text", required: true },
        {
          key: "journal",
          label: "Journal or venue",
          type: "text",
          required: true,
        },
        { key: "year", label: "Year", type: "number", required: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          required: true,
          options: [
            "published",
            "accepted",
            "under_review",
            "manuscript",
            "preprint",
          ].map((value) => ({ value, label: value.replace("_", " ") })),
        },
        {
          key: "doi",
          label: "DOI",
          type: "text",
          placeholder: "10.1234/example",
        },
        { key: "abstract", label: "Abstract", type: "textarea", rows: 10 },
        { key: "research_area", label: "Research area", type: "text" },
        { key: "pdf_url", label: "Public PDF URL", type: "text" },
        { key: "sort_order", label: "Sort order", type: "number" },
      ]}
    />
  );
}
