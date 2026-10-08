# Advanced research facility — implementation tracker

Request: `b2bd81a1-9f9b-4aba-932b-a376656547d0/pasted-text-1.txt`, all 40 sections. This work extends the existing site; the earlier UI enhancement does not prove this larger request complete.

## Preserved invariants
Current routes/navigation, separate pages, database, CMS, authentication, research records, publications, patents, theses, timeline, published notes, contact, and three themes. Supplied microscope and MMSA source/optimized assets remain intact. No fabricated scientific claims, project dates, video clips, publication associations, or skill proficiency scores.

## Implementation and evidence
- Existing Three/Fiber/Drei toolchain inspected. Added GSAP, React GSAP integration, maath, and R3F postprocessing; npm reported zero vulnerabilities at installation. Postprocessing is lazy and high-quality-only. Unused dependencies must be removed if no corresponding feature is delivered.
- Added explicit public-column queries for all projects, patents, theses, published notes, and actual project media. Existing device/seed identity mapping remains intact.
- Scene configuration defines twelve destinations plus two device inspection targets. Archive racks use every record in their category, with no four-paper truncation.
- Reusable physical folders highlight, pull forward, and open; an equivalent HTML directory opens each full research route without WebGL.
- Added user-paced guided route, destination controls, floor-plan navigation, and overview return.
- Added real experiment video monitors and a projector using project_media images. Media loading is limited to the active visible station. Manual slideshow controls and source captions/links are retained.
- Extracted existing About skill names into one shared module without altering their content.
- TypeScript validation passed after initial integration. Rendered verification and regression tests remain in progress.

## Remaining completion gates
1. Render and refine the expanded room: archive placement, occlusion, folder selection, media, and every camera target; desktop/tablet/mobile and all themes.
2. Complete controlled mouse-look/walking behavior and guided camera choreography; verify keyboard and touch alternatives.
3. Expand physical skill equipment, AI multi-monitor station and real method diagrams; link only source-supported relationships.
4. Refine secondary room props/materials, instancing, adaptive rendering, postprocessing, and production-only stripping of development controls.
5. Central shared interaction values: position, velocity, scroll progress/velocity, proximity, hover/active state, damping and lifecycle cleanup.
6. Premium velocity trail, click pulse, interactive cursor states; disable on touch/reduced motion.
7. Distinct interactive data/neural/blueprint/particle/temporal/signal backgrounds per route.
8. Reusable PerspectiveCard, MagneticCard, DepthCard, TiltCard, HoverModel, InteractiveImage, ParallaxImage, FloatingPanel, GlowPanel, ResearchObject with shared behavior.
9. Deliberate display/body/mono fonts and selective luminous/scanning/depth/reveal text.
10. Scroll-linked depth, reveals, stagger, galleries, sticky sections and image interactions within existing pages.
11. Verify every public route, research links, archive links, actual video playback, projector controls, reduced motion, keyboard/focus, mobile/touch, console/network and performance. Build success alone is insufficient.
12. Update design/validation docs with final evidence and limitations. Keep the full goal active until every requirement is verified.

## Reference review
Read the requested repository READMEs and official component documentation before implementation:
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber): reusable declarative objects, pointer events and React 19 compatibility; MIT.
- [Drei](https://github.com/pmndrs/drei): existing controls, Html and asset helpers; MIT. Installed component type/source declarations inspected where hosted docs could not be retrieved.
- [React postprocessing](https://github.com/pmndrs/react-postprocessing) and [EffectComposer](https://react-postprocessing.docs.pmnd.rs/effect-composer): isolated quality-dependent composer.
- [Theatre](https://github.com/theatre-js/theatre): programmatic/visual choreography, Apache-2.0; reviewed, not installed because the current configurable camera can provide the required transitions without a second animation editor.
- [React Bits](https://github.com/DavidHDev/react-bits), [site](https://reactbits.dev/) and [license](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md): MIT plus Commons Clause; component presentation reference, no copied source yet.
- [kwiruu/portfolio](https://github.com/kwiruu/portfolio): room exploration, separate object inspection and return; no reusable license established, no source copied.
- [its-zk/Portfolio](https://github.com/its-zk/Portfolio): layered React/Three/GSAP architecture; no source copied.
- [jawad-portfolio-v2](https://github.com/jawadhaider0024/jawad-portfolio-v2): scroll-driven scene and reusable reveals, MIT; technical reference, no branding copied.
- [webui-3d-examples](https://github.com/fourwiller/webui-3d-examples): interactive selection and restrained scientific/instrument interfaces; no source copied.
- [Lightswind components](https://lightswind.com/components): perspective cards, image galleries, scroll/text treatments reviewed; paid components are not copied or bypassed.

WalkMyPlan and Higgsfield did not expose callable tools in this session. The repository implementation uses the available local development tools and original research assets.
