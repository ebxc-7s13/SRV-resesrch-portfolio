/* Native lab links load its route-specific CSP with the document. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { Entrance } from "./Reveal";
import GalaxyButton from "./GalaxyButton";
import HeroNameHover from "./HeroNameHover";
import Shuffle from "./Shuffle";
import Link from "next/link";
import { SiteText } from "./SiteContent";

const ROLE_TEXT = "BIOMEDICAL ENGINEER";

export default function ResearchHero({
  projectCount,
  thesisCount,
}: {
  projectCount: number;
  thesisCount: number;
}) {
  return (
    <section className="research-hero shell">
      <Entrance className="hero-identity">
        <div className="eyebrow">
          <span className="signal-dot" />
          Biomedical engineering / Research portfolio
        </div>
        <h1>
          <SiteText page="home" name="hero_title">
            <HeroNameHover>
            {["SILUVERU", "RAJA", "VIVEKA", "VARDHAN"].map((word) => (
              <Shuffle
                key={word}
                text={word}
                className="hero-surname"
                shuffleDirection="right"
                shuffleTimes={1}
                duration={0.35}
                animationMode="evenodd"
                ease="power3.out"
                stagger={0.03}
                threshold={0.1}
                triggerOnce
                triggerOnHover
                respectReducedMotion
                loop={false}
                loopDelay={0}
              />
            ))}
            </HeroNameHover>
          </SiteText>
        </h1>
      </Entrance>
      <Entrance className="hero-summary" delay={0.1}>
        {/* Sci-fi role line: the text streams as a blurred trail behind a
            crisp copy (contrast-trick marquee). Hidden from AT; the role is
            plain text in the page elsewhere (hero description, eyebrow). */}
        <div className="hero-role-marquee" aria-hidden="true">
          <div className="marquee_blur">
            <p className="marquee_text">{ROLE_TEXT}</p>
          </div>
          <div className="marquee_clear">
            <p className="marquee_text">{ROLE_TEXT}</p>
          </div>
        </div>
        <p className="hero-description">
          <SiteText page="home" name="hero_subtitle">
            Developing label-free imaging systems and computational methods for
            early disease detection — optical imaging, AI/ML, non-invasive
            diagnostics.
          </SiteText>
        </p>
        <div className="hero-domains">
          <span>Optical imaging</span>
          <span>Computational methods</span>
          <span>Instrumentation</span>
        </div>
        <div className="hero-actions">
          <GalaxyButton
            href="/research"
            seed={1}
            radius="6px"
            className="button interaction-magnetic"
            data-magnet
          >
            <span className="cta-label">
              <SiteText page="home" name="hero_cta_research">
                Explore research ↗
              </SiteText>
            </span>
          </GalaxyButton>
          <GalaxyButton href="#lab" seed={2} radius="6px" className="button secondary">
            Explore the 3D lab{" "}
            <span aria-hidden="true" className="cta-arrow">
              ↓
            </span>
          </GalaxyButton>
        </div>
        <div className="hero-archive-links">
          <Link href="/publications">
            <SiteText page="home" name="hero_cta_publications">
              Publications
            </SiteText>
          </Link>
          <Link href="/thesis">
            <SiteText page="home" name="hero_cta_thesis">
              Theses
            </SiteText>
          </Link>
        </div>
      </Entrance>
      <Entrance className="hero-ledger" delay={0.15}>
        <div data-reveal>
          <strong>{String(projectCount).padStart(2, "0")}</strong>
          <span>Research projects</span>
        </div>
        <div data-reveal>
          <strong>{String(thesisCount).padStart(2, "0")}</strong>
          <span>Academic theses</span>
        </div>
        <p>
          From optical measurement
          <br />
          to computational understanding.
        </p>
        <a href="#lab" className="hero-scroll">
          <span className="hero-scroll-label">Enter the laboratory</span>{" "}
          <span aria-hidden="true" className="hero-scroll-arrow">
            ↓
          </span>
        </a>
      </Entrance>
    </section>
  );
}
