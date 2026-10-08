`public/models/anatomy/meshopt-decoder.js` is the unmodified reference JavaScript decoder from
meshoptimizer 1.2.0 (`meshopt_decoder_reference.js`), copyright Arseny Kapoulkine,
reference implementation by Jasper St. Pierre. Original MIT header preserved.
https://github.com/zeux/meshoptimizer/blob/v1.2/js/meshopt_decoder_reference.js

The license is retained here and at `public/models/anatomy/MESHOPT-LICENSE.txt` beside
the distributed decoder. `meshoptWorker.ts` creates one self-origin module
worker (`public/models/anatomy/decoder-worker.js`) shared across packs. The worker
is terminated on controller disposal or decoding failure; decoding never runs in the
homepage's main thread. Transfers use private copies so the GLB remains intact.

The default WASM decoder would require changing document CSP on every route
from which a visitor can navigate to Home. This bounded feature instead keeps
the existing security headers and uses the reference decoder for audited,
progressively loaded single-primitive packs. No model decode occurs during the
scan loop. See `docs/z-anatomy-report.md` for current measurements; historical
measurements for the removed model no longer apply.
