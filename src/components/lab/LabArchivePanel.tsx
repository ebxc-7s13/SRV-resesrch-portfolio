import Image from "next/image";
import { archiveRecords } from "@/lib/lab-archive";
import type {
  ArchiveSelection,
  ArchiveKind,
  LabContent,
} from "@/lib/lab-devices";

export default function LabArchivePanel({
  content,
  kind,
  selection,
  onSelect,
}: {
  content: LabContent;
  kind: ArchiveKind;
  selection: ArchiveSelection | null;
  onSelect: (selection: ArchiveSelection) => void;
}) {
  const records = archiveRecords(content, kind);
  const selected = records.find(
    (r) => r.id === selection?.id && kind === selection.kind,
  );
  return (
    <div className="lab-archive-panel">
      <div className="lab-folder-index" aria-label={`${kind} folders`}>
        {records.map((r, i) => (
          <button
            key={r.id}
            aria-pressed={selected?.id === r.id}
            onClick={() => onSelect({ kind, id: r.id })}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {r.title}
          </button>
        ))}
      </div>
      {!records.length && <p>No records are currently available.</p>}
      {selected ? (
        <article key={selected.id} className="lab-open-folder">
          <span className="lab-status-tag">{selected.label}</span>
          <h3>{selected.title}</h3>
          {selected.image && (
            <Image
              src={selected.image}
              alt={selected.title}
              width={640}
              height={400}
              sizes="(max-width:760px) 85vw, 360px"
            />
          )}
          <p>{selected.text}</p>
          <a className="lab-button primary" href={selected.href}>
            Open full record ↗
          </a>
          {selected.details.map(([title, text]) => (
            <details className="lab-detail" key={title}>
              <summary>
                {title}
                <span>+</span>
              </summary>
              <p>{text}</p>
            </details>
          ))}
        </article>
      ) : (
        <p>Select a folder to open its research record.</p>
      )}
    </div>
  );
}
