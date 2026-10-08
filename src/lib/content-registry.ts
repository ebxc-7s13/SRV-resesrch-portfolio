// Every registered slot is rendered by SiteText on a public page.
export const contentRegistry: Record<
  string,
  { key: string; label: string; type: "text" | "textarea" }[]
> = {
  home: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "hero_cta_research", label: "CTA: Explore Research", type: "text" },
    {
      key: "hero_cta_publications",
      label: "CTA: View Publications",
      type: "text",
    },
    { key: "hero_cta_thesis", label: "CTA: Read Thesis", type: "text" },
    { key: "featured_title", label: "Featured Research Title", type: "text" },
    {
      key: "featured_subtitle",
      label: "Featured Research Subtitle",
      type: "text",
    },
    {
      key: "publications_title",
      label: "Recent Publications Title",
      type: "text",
    },
    {
      key: "publications_subtitle",
      label: "Recent Publications Subtitle",
      type: "text",
    },
    { key: "notes_title", label: "Research Notes Title", type: "text" },
    { key: "notes_subtitle", label: "Research Notes Subtitle", type: "text" },
    { key: "cta_title", label: "CTA Title", type: "text" },
    { key: "cta_description", label: "CTA Description", type: "textarea" },
    { key: "cta_button_text", label: "CTA Button Text", type: "text" },
  ],
  about: [
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
    { key: "hero_description", label: "Hero Description", type: "textarea" },
    {
      key: "philosophy_quote",
      label: "Research Philosophy Quote",
      type: "textarea",
    },
  ],
  research: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
  ],
  publications: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
  ],
  thesis: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
  ],
  patents: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
  ],
  timeline: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
  ],
  contact: [
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "textarea" },
  ],
  footer: [
    { key: "brand_description", label: "Brand Description", type: "textarea" },
  ],
};
