import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { keep } from './util.js';

// Free (CC0) art we load: Kenney Food Kit + Nature Kit models, Poly Haven sky photos. See CREDITS.md.
const BASE = import.meta.env.BASE_URL;
const store = {};          // loaded model templates by name, e.g. 'food/lollypop'
const hdrEnv = {};         // sky-photo lighting by key

export const MODEL_LIST = [
  ...['lollypop', 'cupcake', 'muffin', 'donut', 'donut-sprinkles', 'donut-chocolate', 'candy-bar', 'chocolate', 'cookie', 'cookie-chocolate', 'ginger-bread', 'ice-cream-cne', 'ice-cream',
    'sundae', 'popsicle', 'popsicle-chocolate', 'cake', 'cake-birthday', 'waffle', 'strawberry', 'cherries', 'pudding', 'whipped-cream', 'pancakes', 'pie'].map((n) => `food/${n}`),
  ...['tree_palm', 'tree_palmBend', 'tree_palmDetailedShort', 'tree_palmDetailedTall', 'tree_palmShort', 'tree_palmTall', 'mushroom_red', 'mushroom_redGroup', 'mushroom_redTall',
    'plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall', 'grass_large', 'rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_smallA', 'rock_smallB',
    'stone_largeA', 'stone_largeB', 'stone_smallA', 'stone_smallB', 'canoe', 'canoe_paddle', 'lily_large', 'flower_redA', 'flower_purpleA', 'flower_yellowA'].map((n) => `nature/${n}`),
];
export const HDR_FILES = { beach: 'kloofendal_48d_partly_cloudy_puresky', candy: 'qwantani_noon_puresky', castle: 'belfast_sunset_puresky' };

/** onProgress.cb(0..1) is told as each model / sky photo arrives (drives the loading bar) */
export const onProgress = { cb: null };
/** Load these models and sky photos (default: everything). Missing files are skipped; the scenes fall back to shapes built in code. */
/** compressed (quantized) vertex data -> plain floats once at load, so the scenes can merge these models with everything else */
function toFloat(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    for (const [name, a] of Object.entries(g.attributes)) {
      if (a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute) continue;
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    }
  });
  return root;
}
/** the models are meshopt-compressed with WebP textures (tools/asset-diet.mjs); one loader with the decoder for everything */
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export async function preloadAssets(renderer, list = MODEL_LIST, { hdr = Object.keys(HDR_FILES) } = {}) {
  const loader = gltf;
  let done = 0; const total = list.length + hdr.length, tick = () => onProgress.cb?.(++done / total);
  const jobs = list.map(async (n) => {
    if (!store[n]) try { store[n] = toFloat((await loader.loadAsync(`${BASE}assets/models/${n}.glb`)).scene); } catch (e) { console.warn('model failed to load:', n, e); }
    tick();
  });
  const pm = new THREE.PMREMGenerator(renderer);
  const hdrJobs = hdr.map(async (key) => {
    const file = HDR_FILES[key];
    if (hdrEnv[key] || !file) return tick();
    try {
      const tex = await new HDRLoader().loadAsync(`${BASE}assets/hdr/${file}.hdr`);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      hdrEnv[key] = pm.fromEquirectangular(tex).texture;
      tex.dispose();
    } catch (e) { console.warn('sky photo failed to load:', file, e); }
    tick();
  });
  await Promise.all([...jobs, ...hdrJobs]);
  pm.dispose();
}

/** Load just these models (e.g. 'food/sundae') into the shared store. */
export async function preloadModels(names) {
  const loader = gltf;
  let done = 0;
  await Promise.all(names.map(async (n) => {
    if (!store[n]) try { store[n] = toFloat((await loader.loadAsync(`${BASE}assets/models/${n}.glb`)).scene); } catch (e) { console.warn('model failed to load:', n, e); }
    onProgress.cb?.(++done / names.length);
  }));
}

export const hasModel = (n) => !!store[n];
export const getHDREnv = (key) => hdrEnv[key];

const matCache = new Map();
function restyle(mat, glossy) {
  const key = mat.uuid + glossy;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshPhysicalMaterial({
    map: mat.map, color: mat.color, vertexColors: mat.vertexColors, side: mat.side, transparent: mat.transparent, opacity: mat.opacity, alphaTest: mat.alphaTest,
    roughness: glossy ? 0.34 : 0.6, clearcoat: glossy ? 0.7 : 0, clearcoatRoughness: 0.18,
  });
  matCache.set(key, m); keep.add(m);          // shared by every copy of the model, in every scene
  return m;
}

/**
 * A fresh copy of a loaded model, sized so it is `height` units tall, standing on y=0 and centred on x/z.
 * Returns null if the model didn't load, so callers can fall back to something built in code.
 */
export function model(name, { height, size: maxDim, glossy = true } = {}) {
  const src = store[name];
  if (!src) return null;
  const m = src.clone(true);
  m.traverse((o) => { if (o.isMesh) { o.material = restyle(o.material, glossy); o.castShadow = true; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -box.min.y, -c.z);
  const wrap = new THREE.Group(); wrap.add(m);
  if (maxDim) wrap.scale.setScalar(maxDim / Math.max(size.x, size.y, size.z));      // fit the biggest side (for flat things like grass)
  else if (height) wrap.scale.setScalar(height / size.y);
  wrap.userData.baseScale = wrap.scale.x;
  return wrap;
}
