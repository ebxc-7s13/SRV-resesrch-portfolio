# Laboratory validation

Local validation performed on 14 September 2026 against the existing application and persistent development content. No external deployment was performed.

## Automated checks

- `npm test`: passed all 17 reported tests (16 cases inside the database-backed regression test). This covers seed recovery and preservation, authentication/session revocation, protected CMS handlers, publication edits, public field projection, stable laboratory content identities after CMS edits, and rejection of the model inspector in production.
- `npm run lint`: passed with no warnings or errors.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run models:validate`: passed for all four GLBs. Decoded bounds, finite normals, output sizes and triangle counts matched the manifest; no raw source model/archive was present under `public`.
- `npm run build`: passed, including compilation, lint, type checking and generation of all 21 static pages.

## Production checks

Started the final production build against the persistent local development database. All 17 HTTP/content checks passed: the homepage, laboratory, both linked projects, publications, patents, timeline, notes and admin entry returned 200; the development model viewer and private source path returned 404; an unauthenticated admin API request returned 401. All four GLBs returned their exact manifest byte lengths and the expected cache header.

The lab document included the Wasm-only CSP permission; the homepage did not. Neither enabled JavaScript eval in production. `/lab?debug=1` omitted development test controls and retained the two existing research links. The middleware rejects the model viewer before Next.js streaming can commit an HTTP 200 response.

Opened a fresh production browser tab, selected MMSA, and inspected the rendered device and its correct research panel. The locally bundled mesh decoder worked under the production CSP. The fresh tab reported zero browser errors and one `THREE.Clock` deprecation warning. Evidence: `.qa/laboratory-http-checks.json`, `.qa/laboratory-browser-logs.json` and `.qa/models/production-mmsa.png`.

## Rendered browser checks

- Inspected the actual imported microscope and MMSA independently, then on their workstations. Checked orientation, support feet/base, framing, material appearance and the retained mechanical silhouette. Compared all three MMSA quality tiers in the model viewer.
- Visited the imaging and engineering stations and inspected both devices. The panels displayed their existing project records and supported patent associations. Publication records remained available without inventing device-to-publication relationships.
- Used keyboard rotation/zoom controls, closed inspection with Escape, and verified the return control received focus. Verified the system reduced-motion preference disabled camera transitions; exercised animated station transitions through the development override.
- Triggered actual WebGL context loss using the development test control. The HTML research fallback remained available and retry recreated the scene. Also exercised the explicit 2D switch.
- Tested a 390 × 844 browser viewport. Low quality was selected, the device stayed framed, controls remained available, and the research panel stacked below the scene. Publication details and original record links remained accessible.
- Captured the static equipment and room previews from the rendered supplied models. Corrected and rechecked the crops before writing the final WebP assets.

## Loading and transfer checks

The development resource display showed no GLB requests before entering. Entering initially loaded only the microscope; visiting engineering requested Medium MMSA; explicitly selecting High during MMSA inspection requested the full model. A fresh narrow viewport requested only the microscope and Low MMSA.

| Model | File bytes | Observed encoded response bytes |
| --- | ---: | ---: |
| Microscope | 35,244 | 22,975 |
| MMSA Medium | 1,052,560 | 769,210 |
| MMSA Low | 332,984 | 259,172 |
| MMSA High | 2,470,636 | Not separately recorded |

Encoded response sizes depend on server compression and caching. Some repeat requests used cache revalidation; these figures are not claims about total first-visit JavaScript cost or download time. The production build reports `/lab` at approximately 115 kB of first-load JavaScript before the deferred 3D scene.

## Limits and follow-up considerations

- Browser viewport testing is not a physical-phone GPU, battery or thermal benchmark. High retains 779,396 triangles and is intentionally opt-in. Test representative physical devices before setting device-specific frame-rate promises.
- Three/Fiber currently emits a non-fatal `THREE.Clock` deprecation warning. It did not prevent rendering or interaction; updating this dependency integration is separate from the supplied-asset work.
- No comprehensive assistive-technology certification or automated accessibility score is claimed. Keyboard paths, focus return, reduced motion and HTML fallback were exercised directly.
- Scientific statements and status labels remain the existing database content. The outstanding questions in `CONTENT_CONFIRMATION.md` and the source archive's missing explicit license terms remain documented; this work does not resolve them.

See `LABORATORY.md` for the source inspection, conversion pipeline, data mappings and deployment requirements. Local screenshots and HTTP-check evidence are stored under ignored `.qa/` paths.
