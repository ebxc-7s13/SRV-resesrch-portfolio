## Skill Selection Policy
# Skill Selection Policy

Do NOT use every available skill.

Before any substantial task, first inspect the repository with Graphify.

Then select the smallest relevant set of specialist skills.

## UI/UX
Use:
- designing-frontend-interfaces
- designing-user-experience
- frontend-design-systems
- reviewing-interface-quality

Use `high-end-visual-design` when the task is primarily visual/art-direction work.

## 3D / R3F
Use:
- r3f-scene-architect for scene architecture
- r3f-graphics-builder for geometry, materials, lighting and visual implementation
- r3f-ui-designer for 3D UI / HUD / HTML overlays
- r3f-game-director for camera choreography and walkthroughs
- r3f-debug-profiler for performance issues
- webgl-threejs-expert-skill for shaders, GPU rendering, asset optimization and advanced WebGL
- r3f-qa-release for final 3D verification

## Animation
Use:
- gpt-taste for GSAP / ScrollTrigger
- emil-design-eng for motion design
- find-animation-opportunities before adding unnecessary animation
- improve-animations when refining existing motion
- review-animations after significant animation work

## Performance
Use:
- investigating-performance
- vercel-react-best-practices
- r3f-debug-profiler
- webgl-threejs-expert-skill

## Browser verification
Use:
- playwright-mcp-workflows
- testing-webapps
- verifying-before-completion

## Repository intelligence
Always use:
- graphify

## Planning
For large changes use:
- writing-plans
- executing-plans

## Important
Do not invoke unrelated skills simply because they are available.

Do not use image-generation or decorative-art skills for actual research content unless explicitly requested.

Do not modify unrelated routes or systems.

Always inspect the rendered result before declaring a visual task complete.
Do NOT invoke every available skill.

For substantial tasks:

1. Use `graphify` first to understand the repository and identify affected files.
2. Use the smallest appropriate design/UX skill for visual planning.
3. For Three.js / React Three Fiber work, select the specific R3F skill that matches the task:
   - `r3f-scene-architect` for scene architecture
   - `r3f-graphics-builder` for visual/geometry/lighting implementation
   - `r3f-ui-designer` for 3D UI/HUD/HTML overlays
   - `r3f-game-director` for camera choreography, sequencing and complex scene direction
   - `r3f-debug-profiler` for performance problems
   - `r3f-qa-release` for final visual/runtime QA
   - `r3f-skill-smith` only when extending the skill/tooling system
4. Use `gpt-taste` for GSAP/ScrollTrigger work.
5. Use `reviewing-interface-quality` after significant UI changes.
6. Use `investigating-performance` when animation or WebGL performance is affected.
7. Use `testing-webapps` and `verifying-before-completion` before declaring a feature complete.
8. Do not invoke unrelated image-generation or decorative-art skills unless the task specifically requires them.

Prefer a small number of relevant skills over many overlapping skills.
## graphify
## Repository intelligence

Use the Graphify skill before making substantial changes to this codebase.

For architecture questions, large refactors, UI/UX redesigns, Three.js/R3F work, and multi-file changes:

1. Query the Graphify knowledge graph first.
2. Identify affected routes, components, APIs, assets, and dependencies.
3. Read only the files relevant to the requested change.
4. Do not repeatedly scan unrelated parts of the repository.
5. After significant structural changes, update the Graphify graph.

For this repository, Graphify is the preferred source for understanding code relationships.
This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
