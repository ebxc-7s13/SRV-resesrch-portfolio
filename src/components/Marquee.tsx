"use client";

const TEXT =
  " ◆ BIOMEDICAL ENGINEERING ◆ ORAL CANCER DETECTION ◆ AUTOFLORESCENCE IMAGING ◆ DEEP LEARNING ◆ LABEL-FREE DIAGNOSTICS ◆ OPTICAL IMAGING ◆ NON-INVASIVE DIAGNOSTICS ◆ COMPUTATIONAL PATHOLOGY ◆ MICROGRAVITY SIMULATION ◆ FASCANET ◆ AFIS-NET ◆";

interface MarqueeProps {
  direction?: "left" | "right";
  sticky?: boolean;
}

export default function Marquee({
  direction = "left",
  sticky = false,
}: MarqueeProps) {
  const half = TEXT.repeat(2);
  const animName = direction === "left" ? "scrollLeft" : "scrollRight";
  // Full shorthand (not just animationName): duration defaults to 0s, so a
  // bare name never runs on its own and the stylesheet's hardcoded scrollLeft
  // would silently win over direction="right".

  return (
    <div
      className="research-marquee"
      aria-hidden="true"
      style={{
        width: "100%",
        overflow: "hidden",
        backgroundColor: "white",
        paddingTop: "2px",
        paddingBottom: "2px",
        zIndex: 51,
        userSelect: "none",
        whiteSpace: "nowrap",
        position: sticky ? "sticky" : "relative",
        top: sticky ? "0" : undefined,
      }}
    >
      <div
        className="marquee-track"
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          // Keep the compositor hint inline so it survives the shorthand
          // animation reset between direction switches.
          willChange: "transform",
          backfaceVisibility: "hidden",
          animation: `${animName} 80s linear infinite`,
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontFamily: "var(--font-jetbrains), monospace",
            fontWeight: 700,
            letterSpacing: "0.15em",
            // Use the dark palette shade on this white strip.
            color: "rgb(var(--marquee-ink))",
            textTransform: "uppercase",
          }}
        >
          {half}&nbsp;&nbsp;&nbsp;{half}
        </span>
      </div>
    </div>
  );
}
