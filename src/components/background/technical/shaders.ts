// Original procedural scenes. Geometry and lighting are computed on the GPU;
// only time, pointer and a fixed-size impulse pool change between frames.
const uniforms = /* glsl */ `
  uniform float uTime;
  uniform float uClock;
  uniform float uResponse;
  uniform float uAspect;
  uniform float uDpr;
  uniform vec3 uPointer;
  uniform vec4 uImpulses[6];
  const float TAU = 6.28318530718;

  mat2 turn(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  // A propagating, damped wave. Its age uses real time independently of the
  // animation-speed slider, so impulses settle even when the scene is still.
  float impulse(vec2 p) {
    float wave = 0.0;
    for (int i = 0; i < 6; i++) {
      float age = uClock - uImpulses[i].z;
      float d = length(p - uImpulses[i].xy);
      float front = d - age * 2.1;
      wave += sin(front * 8.0) * exp(-front * front * 2.5)
        * exp(-age * 0.85) * uImpulses[i].w;
    }
    return wave * uResponse;
  }
`;

export const fluxVertex = uniforms + /* glsl */ `
  attribute vec2 aStrand;
  uniform float uParticles;
  uniform float uLayer;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float lane = aStrand.y;
    float phase = fract(aStrand.x + uTime * 0.055 * uParticles);
    float a = phase * TAU;
    float b = lane * TAU + a * 3.0 + uTime * 0.23;
    float radius = 1.95 + 0.2 * sin(a * 3.0 + uTime * 0.32);
    float braid = 0.58 + 0.17 * sin(a * 2.0 - uTime * 0.3);
    vec3 p = vec3((radius + braid * cos(b)) * cos(a),
                  (radius + braid * cos(b)) * sin(a), braid * sin(b));
    p.yz = turn(0.72 + sin(uTime * 0.16) * 0.25) * p.yz;
    p.xz = turn(uTime * 0.09) * p.xz;
    p.xy = turn(-0.36 + sin(uTime * 0.12) * 0.18) * p.xy;
    p.x *= max(1.0, uAspect * 0.82);
    p.xy += vec2(0.5 * uAspect, -0.12);
    if (uLayer > 0.5) {
      p *= vec3(1.9, 1.6, 0.8);
      p.xy += vec2(-2.8 * uAspect, 0.6);
      p.z -= 1.6;
    }

    vec2 d = p.xy - uPointer.xy;
    float proximity = exp(-dot(d, d) * 0.9) * uPointer.z * uResponse;
    p.xy += d * proximity * 0.5;
    p.z += proximity * 1.2;
    float wave = impulse(p.xy);
    p.xy += normalize(p.xy + vec2(0.001)) * wave * 0.22;
    p.z += wave * 0.55;

    // Copper and cyan conductors alternate around the braid. Electron beads
    // are brighter than the continuous fine wires, with depth attenuation.
    vec3 copper = vec3(1.0, 0.43, 0.12);
    vec3 cyan = vec3(0.13, 0.75, 0.85);
    vColor = mix(copper, cyan, smoothstep(0.25, 0.7, sin(lane * TAU) * 0.5 + 0.5));
    float current = pow(0.5 + 0.5 * sin(a * 4.0 - uTime * 1.9 + lane * 12.0), 10.0);
    vColor *= 0.42 + current * 1.8 + proximity * 0.8 + abs(wave) * 0.6;
    vAlpha = (0.26 + 0.36 * smoothstep(-1.2, 1.1, p.z)) * mix(1.0, 1.6, uParticles);
    vAlpha *= mix(1.0, 0.38, uLayer);
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = min(8.0, (2.2 + current * 2.0 + proximity * 2.5) * uDpr * 7.0 / -view.z);
  }
`;

export const fluxFragment = /* glsl */ `
  uniform float uParticles;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float alpha = vAlpha;
    if (uParticles > 0.5) {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      alpha *= exp(-d * d * 4.5);
      if (d > 1.0) discard;
    }
    gl_FragColor = vec4(vColor, alpha);
    #include <colorspace_fragment>
  }
`;

export const prismVertex = uniforms + /* glsl */ `
  attribute vec3 aOffset;
  attribute float aSeed;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vEnergy;
  varying float vSeed;

  void main() {
    vec3 centre = aOffset;
    float drift = sin(centre.x * 1.4 + centre.y * 1.8 + uTime * 0.75);
    centre.z += drift * 0.25 + sin(centre.y * 2.1 - uTime * 0.5) * 0.18;
    vec2 d = centre.xy - uPointer.xy;
    float hover = exp(-dot(d, d) * 1.2) * uPointer.z * uResponse;
    float wave = impulse(centre.xy);
    float tilt = sin(uTime * 0.3) * 0.22 + aSeed * 0.12 + drift * 0.23;
    vec3 p = position;
    vec3 n = normal;
    mat2 rx = turn(0.15 + drift * 0.3 + hover * d.y * 1.2 + wave * 1.8);
    mat2 ry = turn(tilt + hover * d.x * 1.2 + wave);
    p.yz = rx * p.yz; n.yz = rx * n.yz;
    p.xz = ry * p.xz; n.xz = ry * n.xz;
    centre.xy += d * hover * 0.15 + normalize(d + 0.001) * wave * 0.14;
    centre.z += hover * 0.7 + wave * 0.65;
    p += centre;
    vNormal = n;
    vPosition = p;
    vEnergy = hover + abs(wave) * 0.7;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const prismFragment = uniforms + /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vEnergy;
  varying float vSeed;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 eye = normalize(vec3(0.0, 0.0, 8.0) - vPosition);
    vec3 reflected = reflect(-eye, n);
    float fresnel = pow(1.0 - abs(dot(n, eye)), 3.0);
    float key = pow(max(0.0, dot(reflected, normalize(vec3(-0.4, 1.0, 1.5)))), 22.0);
    float strip = pow(1.0 - abs(sin(reflected.y * 3.4 + reflected.x * 1.7 + uTime * 0.13)), 12.0);
    float rim = pow(max(0.0, dot(reflected, normalize(vec3(1.0, -0.5, 0.8)))), 18.0);
    vec3 spectrum = 0.5 + 0.5 * cos(TAU * (vec3(0.04, 0.22, 0.48) + reflected.z * 0.28 + vSeed * 0.11));
    vec3 base = vec3(0.012, 0.025, 0.036);
    vec3 brass = vec3(0.9, 0.69, 0.26);
    vec3 color = base + spectrum * fresnel * 0.17;
    color += brass * (key * 0.8 + strip * 0.22);
    color += vec3(0.16, 0.64, 0.83) * rim * 0.5;
    color += spectrum * vEnergy * (0.1 + key * 0.6);
    color *= 0.75 + smoothstep(-0.6, 0.7, vPosition.z) * 0.3;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const membraneHeight = /* glsl */ `
  float heightAt(vec2 p) {
    vec2 q = turn(-0.42 + sin(uTime * 0.13) * 0.12) * p;
    float h = sin(q.x * 1.8 + q.y * 0.65 + uTime * 0.7) * 0.48;
    h += sin(q.y * 2.4 - q.x * 0.35 - uTime * 0.55) * 0.3;
    h += sin(q.x * 3.0 + q.y * 2.1 + uTime * 0.3) * 0.1;
    vec2 d = p - uPointer.xy;
    h -= exp(-dot(d, d) * 1.25) * uPointer.z * uResponse * 1.15;
    return h + impulse(p) * 0.38;
  }
`;

export const membraneVertex = uniforms + membraneHeight + /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vSurface;
  void main() {
    vec3 p = position;
    float h = heightAt(p.xy);
    float hx = heightAt(p.xy + vec2(0.025, 0.0));
    float hy = heightAt(p.xy + vec2(0.0, 0.025));
    vNormal = normalize(vec3((h - hx) / 0.025, (h - hy) / 0.025, 1.0));
    p.z = h;
    vSurface = p.xy;
    vPosition = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const membraneFragment = uniforms + /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vSurface;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 eye = normalize(vec3(0.0, 0.0, 8.0) - vPosition);
    vec3 r = reflect(-eye, n);
    float facing = max(0.0, dot(n, eye));
    float sheen = pow(max(0.0, dot(r, normalize(vec3(-0.3, 0.9, 1.2)))), 13.0);
    float band = pow(1.0 - abs(sin(r.y * 3.0 + r.x * 1.2)), 5.0);
    vec3 pearl = vec3(0.46, 0.68, 0.68);
    vec3 spectrum = 0.5 + 0.5 * cos(TAU * (vec3(0.2, 0.38, 0.57) + facing * 0.65 + vPosition.z * 0.1));
    vec3 color = vec3(0.013, 0.027, 0.037) + spectrum * (0.04 + band * 0.16);
    color += pearl * sheen * 0.6;

    // Finely ruled ribs follow the deformed foil, rather than a screen-space
    // texture. Anti-aliased interference lines reveal the actual curvature.
    float coordinate = vSurface.x * 22.0 + vSurface.y * 8.0 + vPosition.z * 7.0;
    float width = max(fwidth(coordinate), 0.02);
    float rib = 1.0 - smoothstep(0.07, 0.07 + width, abs(fract(coordinate) - 0.5));
    color *= 0.65 + rib * 0.75;
    color += spectrum * rib * (0.09 + pow(1.0 - facing, 2.0) * 0.3);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;
