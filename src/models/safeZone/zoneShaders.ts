/**
 * Containment zone shaders.
 * - Wall: unit-radius open cylinder scaled to the zone radius; hex energy
 *   lattice that is brightest at ground level and fades upward.
 * - Ground: one plane that tints everything outside the zone and draws the
 *   current edge, the shrink target and the next-tier preview as rings.
 */
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, NormalBlending } from "three";

export const WALL_HEIGHT = 16;

const WALL_VERTEX = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WALL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform float uOpacity;
  uniform float uPulse;
  uniform float uHeight;
  uniform vec3 uColor;
  varying vec3 vLocal;

  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
  }

  void main() {
    float h = vLocal.y + 0.5 * uHeight;
    float hn = clamp(h / uHeight, 0.0, 1.0);

    // Integer number of cells around the ring so the pattern has no seam
    float ang = atan(vLocal.z, vLocal.x);
    if (ang < 0.0) ang += 6.2831853;
    float circumference = 6.2831853 * max(uRadius, 0.5);
    float cells = max(8.0, floor(circumference * 0.55));
    float cellWorld = circumference / cells;
    vec2 uv = vec2(ang / 6.2831853 * cells, h / cellWorld);

    vec2 r = vec2(1.0, 1.7320508);
    vec2 hh = r * 0.5;
    vec2 a = mod(uv, r) - hh;
    vec2 b = mod(uv - hh, r) - hh;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    float edge = 0.5 - hexDist(gv);
    float line = 1.0 - smoothstep(0.0, fwidth(edge) * 1.5 + 0.02, edge);

    float scan = smoothstep(0.85, 1.0, sin(h * 1.6 - uTime * 2.4) * 0.5 + 0.5);
    float sweep = smoothstep(0.96, 1.0, sin(ang * 3.0 - uTime * 0.8) * 0.5 + 0.5);
    float fade = pow(1.0 - hn, 1.8);
    float base = smoothstep(1.6, 0.0, h);

    float alpha = (0.12 + line * 0.5 + scan * 0.35 + sweep * 0.25) * fade + base * 0.9;
    alpha *= uOpacity * (1.0 + uPulse * 0.45 * sin(uTime * 6.0));
    gl_FragColor = vec4(uColor * (1.0 + base * 0.6), clamp(alpha, 0.0, 1.0));
  }
`;

export function createWallMaterial(color: string, opacity: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: WALL_VERTEX,
    fragmentShader: WALL_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: 50 },
      uOpacity: { value: opacity },
      uPulse: { value: 0 },
      uHeight: { value: WALL_HEIGHT },
      uColor: { value: new Color(color) },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    extensions: { derivatives: true },
  });
}

const GROUND_VERTEX = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vXZ = vec2(position.x, -position.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GROUND_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform float uTarget;
  uniform float uNext;
  uniform float uNextAlpha;
  uniform float uDanger;
  uniform vec3 uEdgeColor;
  varying vec2 vXZ;

  float ring(float d, float radius, float width, float aa) {
    return 1.0 - smoothstep(width, width + aa, abs(d - radius));
  }

  float dashes(float radius, float speed) {
    float arc = atan(vXZ.y, vXZ.x) * radius;
    return step(0.45, fract(arc / 1.8 + uTime * speed));
  }

  void main() {
    float d = length(vXZ);
    float aa = fwidth(d) * 1.5;

    // Outside the zone: hazard tint with scrolling stripes hugging the edge
    float outside = smoothstep(uRadius, uRadius + aa, d);
    float stripes = step(0.55, fract((vXZ.x + vXZ.y) * 0.3 - uTime * 0.35));
    float nearEdge = 1.0 - smoothstep(uRadius, uRadius + 6.0, d);
    vec4 col = vec4(0.5, 0.05, 0.03, outside * (0.2 + 0.12 * uDanger + nearEdge * stripes * 0.2));

    // Live boundary
    float edge = ring(d, uRadius, 0.18, aa);
    float edgeHalo = ring(d, uRadius, 0.9, 1.2) * 0.35;
    col.rgb = mix(col.rgb, uEdgeColor, max(edge, edgeHalo));
    col.a = max(col.a, max(edge * 0.95, edgeHalo));

    // Shrink target (red dashes)
    if (uTarget > 0.0) {
      float t = ring(d, uTarget, 0.1, aa) * dashes(uTarget, 0.25);
      col.rgb = mix(col.rgb, vec3(1.0, 0.28, 0.22), t);
      col.a = max(col.a, t * 0.9);
    }

    // Next containment tier preview (orange, pulsing)
    if (uNext > 0.0) {
      float n = ring(d, uNext, 0.12, aa) * dashes(uNext, -0.3) * uNextAlpha;
      col.rgb = mix(col.rgb, vec3(1.0, 0.6, 0.1), n);
      col.a = max(col.a, n);
    }

    if (col.a < 0.003) discard;
    gl_FragColor = col;
  }
`;

export function createGroundMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: GROUND_VERTEX,
    fragmentShader: GROUND_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: 50 },
      uTarget: { value: 0 },
      uNext: { value: 0 },
      uNextAlpha: { value: 0 },
      uDanger: { value: 0 },
      uEdgeColor: { value: new Color("#5fdcff") },
    },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    extensions: { derivatives: true },
  });
}
