// One renderer + post-processing chain for every 3D game (three r186):
// scene (multisampled, half-float) -> [game extras] -> soft bloom -> tone map -> colour grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Q, loadTier, applyAutoTier, resetAutoTier } from './quality.js';

/** colour grade: a touch more saturation + contrast so pastels pop, and a soft vignette. Runs after tone mapping on 0-1 screen colours. */
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, con: { value: 1.06 }, vig: { value: 0.18 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, con, vig; varying vec2 vUv;
    void main(){ vec4 t = texture2D(tDiffuse, vUv); float l = dot(t.rgb, vec3(.2126, .7152, .0722));
      vec3 c = mix(vec3(l), t.rgb, sat); c = (c - .5) * con + .5;
      c *= 1. - smoothstep(.45, .95, distance(vUv, vec2(.5))) * vig;
      gl_FragColor = vec4(clamp(c, 0., 1.), t.a); }`,
};

const coarse = () => matchMedia('(pointer: coarse)').matches;

/**
 * opts: toneMapping, exposure, bloom {strength, radius, threshold}, grade {sat, con, vig} or gradePass (a custom ShaderPass),
 * extraPasses (added after the scene render, before bloom), shadows (bool).
 * Set api.onResize(aspect) and api.onTier(Q) for game-specific work.
 */
export function createPipeline(canvas, {
  toneMapping = THREE.NeutralToneMapping, exposure = 1, bloom = { strength: .35, radius: .5, threshold: .85 },
  grade = {}, gradePass = null, extraPasses = [], shadows = true,
} = {}) {
  loadTier();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;            // PCFSoftShadowMap was removed in r186
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: coarse() ? 2 : 4 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), bloom.strength, bloom.radius, bloom.threshold);
  const gradeP = gradePass || new ShaderPass(GradeShader);
  if (!gradePass) for (const [k, v] of Object.entries(grade)) if (gradeP.uniforms[k]) gradeP.uniforms[k].value = v;
  composer.addPass(renderPass); extraPasses.forEach((p) => composer.addPass(p));
  composer.addPass(bloomPass); composer.addPass(new OutputPass()); composer.addPass(gradeP);

  const timer = new THREE.Timer(); timer.connect(document);  // pauses cleanly while the iPad is locked / the tab is hidden
  const api = {
    renderer, composer, renderPass, bloomPass, grade: gradeP, timer, pixelRatio: 1,
    onResize: null, onTier: null,
    setScene(scene, camera) { renderPass.scene = scene; renderPass.camera = camera; },
    resize() {
      const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio, Q.pr);
      api.pixelRatio = pr;
      renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h);
      bloomPass.setSize(w * pr * .5, h * pr * .5);           // bloom at half resolution: no visible difference, a big saving on an iPad
      api.onResize?.(w / h, w, h);
    },
    applyTier() { bloomPass.enabled = Q.bloom; api.onTier?.(Q); api.resize(); },
    /** call once per frame with the real frame time in seconds; also adjusts the quality tier when needed */
    render(frameDt = 1 / 60) { if (applyAutoTier(frameDt)) api.applyTier(); composer.render(); },
    /** run the game: fn(dt, rawDt) each frame (dt is capped at 50 ms); return false from fn to skip drawing that frame */
    start(fn) {
      renderer.setAnimationLoop((ts) => {
        timer.update(ts); const raw = Math.max(0, timer.getDelta());   // right after the page becomes visible the frame time can come out negative
        if (fn(Math.min(raw, .05), raw) !== false) api.render(raw);
      });
    },
  };
  addEventListener('resize', api.resize);
  addEventListener('orientationchange', () => setTimeout(api.resize, 200));   // iOS reports the old size for a moment after rotating
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resetAutoTier(); });
  api.applyTier();
  return api;
}
