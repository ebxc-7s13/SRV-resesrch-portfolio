"use client";
/* eslint-disable @next/next/no-img-element */
import type { LabMedia } from "@/lib/lab-devices";
export default function ProjectorPanel({
  images,
  index,
  playing,
  motion,
  onIndex,
  onPlaying,
}: {
  images: LabMedia[];
  index: number;
  playing: boolean;
  motion: boolean;
  onIndex: (index: number) => void;
  onPlaying: (playing: boolean) => void;
}) {
  const media = images[index % Math.max(images.length, 1)];
  if (!media) return <p>No research images are available.</p>;
  return (
    <div className="lab-projector-panel">
      <figure>
        <img
          key={media.id}
          src={media.file_path}
          alt={media.caption || media.title}
        />
        <figcaption>
          {media.caption || media.caption_title || media.title}
        </figcaption>
      </figure>
      <div className="lab-projector-controls">
        <button
          onClick={() => onIndex((index - 1 + images.length) % images.length)}
          aria-label="Previous research image"
        >
          ←
        </button>
        <button
          aria-pressed={playing}
          disabled={!motion}
          title={
            !motion
              ? "Automatic slides respect your motion preference. Use Previous and Next."
              : undefined
          }
          onClick={() => onPlaying(!playing)}
        >
          {playing ? "Pause slideshow" : "Play slideshow"}
        </button>
        <button
          onClick={() => onIndex((index + 1) % images.length)}
          aria-label="Next research image"
        >
          →
        </button>
      </div>
      <p className="lab-eyebrow">
        {index + 1} / {images.length} RESEARCH IMAGES
      </p>
      <h3>{media.title}</h3>
      <a className="lab-button primary" href={`/research/${media.slug}`}>
        Open project ↗
      </a>
    </div>
  );
}
