"use client";
import { useId, useRef, useState } from "react";
import Image from "next/image";
interface Props {
  src: string;
  alt: string;
  captionTitle?: string | null;
  caption?: string | null;
}
export default function FigureViewer({
  src,
  alt,
  captionTitle,
  caption,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId();
  const [zoomed, setZoomed] = useState(false);
  // The 1800w dialog image only downloads on first open: the <dialog> is in
  // the DOM from page load, so an unconditional <Image> prefetches megabytes
  // of full-size figures the visitor may never inspect. The dialog (toolbar,
  // caption, close) still opens instantly; the large image streams in after.
  const [opened, setOpened] = useState(false);
  return (
    <>
      <button
        ref={trigger}
        className="figure-trigger interaction-surface interaction-image"
        data-depth
        onClick={() => {
          setZoomed(false);
          setOpened(true);
          dialog.current?.showModal();
        }}
        aria-label={"Enlarge figure: " + (captionTitle || alt)}
      >
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={800}
          className="figure-image"
          sizes="(max-width: 768px) 90vw, 850px"
        />
        <span className="figure-hint">Inspect figure ↗</span>
      </button>
      {(captionTitle || caption) && (
        <figcaption>
          {captionTitle && <strong>{captionTitle} </strong>}
          {caption}
        </figcaption>
      )}
      <dialog
        ref={dialog}
        className="figure-dialog"
        aria-labelledby={id}
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="dialog-toolbar">
          <h2 id={id}>{captionTitle || "Research figure"}</h2>
          <button
            className="button secondary"
            aria-pressed={zoomed}
            onClick={() => setZoomed(!zoomed)}
          >
            {zoomed ? "Fit image" : "Zoom image"}
          </button>
          <button
            autoFocus
            onClick={() => dialog.current?.close()}
            className="button secondary"
          >
            Close ×
          </button>
        </div>
        <div className="figure-scroll">
          {opened && (
            <Image
              src={src}
              alt={alt}
              width={1800}
              height={1200}
              sizes="95vw"
              className={`figure-full ${zoomed ? "figure-zoomed" : ""}`}
            />
          )}
        </div>
        <p>{caption || alt}</p>
        <a
          className="text-link"
          href={src}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original image ↗
        </a>
      </dialog>
    </>
  );
}
