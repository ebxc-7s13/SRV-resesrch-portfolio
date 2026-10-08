"use client";
import { useEffect, useRef, useState } from "react";
import type { LabMedia } from "@/lib/lab-devices";

export default function LabVideoPlayer({
  media,
  playing,
  onElement,
}: {
  media: LabMedia;
  playing: boolean;
  onElement: (element: HTMLVideoElement | null) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (playing) element.play().catch(() => {});
    else element.pause();
    return () => element.pause();
  }, [playing]);
  useEffect(() => () => onElement(null), [onElement]);
  return (
    <figure className="lab-video-player">
      <video
        ref={video}
        src={media.file_path}
        poster={media.cover_image || undefined}
        controls
        muted
        playsInline
        loop
        preload="metadata"
        aria-label={media.caption_title || media.title}
        onLoadedData={() => onElement(video.current)}
        onError={() => setError(true)}
      />
      <figcaption>
        {media.caption || media.caption_title || media.title}
      </figcaption>
      {error && (
        <p role="status">
          This video could not load.{" "}
          <a href={media.file_path}>Open the original video</a>.
        </p>
      )}
      <a className="lab-text-link" href={`/research/${media.slug}`}>
        Open the experiment’s research page ↗
      </a>
    </figure>
  );
}
