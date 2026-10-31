import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyTraitVisibility } from '@avatar/traits.js';
import { createAvatarDriver, CaptureTracker } from '@avatar/runtime.ts';
import { createAvatarPhysics } from '@avatar/runtime/physics.ts';
import { normalizeMouthFlexPose } from '@avatar/integration/mouth-lipsync.ts';
import { createMouthProps } from '@avatar/integration/mouth-props.ts';
import buildInfo from './model-build.json';
import costumeCatalog from './costume-catalog.json';
import { captureAnimatedPreview } from './export-preview.js';

const $ = (selector) => document.querySelector(selector);
const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0));
const smooth = (a, b, dt, speed = 14) => a + (b - a) * (1 - Math.exp(-dt * speed));
const normalName = name => name.replace(/[^a-z0-9]/gi, '').toLowerCase();
const animals = ['frog', 'axolotl', 'rabbit', 'shark', 'fox', ...costumeCatalog.map(item => item.id)];
const bottoms = ['jeans', 'cargo', 'sport', 'utility'];
const baseline = { type: 'plain', eyes: 'expressive', hair: 'none', prop: 'none', clothes: 'none', bottoms: 'none', headphones: 'black' };
const presets = [
  { id: 'brain', title: 'brain mfer', label: 'brain', icon: '🧠', caption: 'big thoughts. tiny responsibilities.', note: 'an open mind, literally.', color: '#e9e2ed', traits: { type: 'brain', headphones: 'black' } },
  { id: 'eyes', title: 'say it with your eyes', label: 'expressive eyes', icon: '◉ ◉', caption: 'one eyebrow says a thousand words.', note: 'try happy, hmm, and oh wow — or your webcam.', color: '#e4eada', traits: { type: 'plain', headphones: 'red' } },
  { id: 'ponytail', title: 'a little tied up', label: 'ponytail', icon: '〰', caption: 'good hair. zero effort.', note: 'head movement gives the ponytail a little lag.', color: '#e7decd', traits: { type: 'charcoal', hair: 'ponytail', headphones: 'white', clothes: 'collared_white' } },
  { id: 'cigar', title: 'big cigar energy', label: 'cigar', icon: '≋', caption: 'absolutely no further comments.', note: 'a glowing tip, crooked ash, and a proper bite.', color: '#ead9ce', traits: { type: 'plain', prop: 'cigar', headphones: 'green' } },
  { id: 'bubblegum', title: 'pop culture', label: 'bubblegum', icon: '○', caption: 'important thoughts. interrupted.', note: 'hit “blow a bubble.” this one waits for you.', color: '#ecdce6', traits: { type: 'plain', prop: 'bubblegum', headphones: 'pink', hair: 'ponytail' } },
  { id: 'frog', title: 'frog mode', label: 'frog hoodie', icon: '⌒ ⌒', caption: 'head empty. pond full.', note: 'a soft hood, little frog eyes, and a lot of personality.', color: '#dfe9d5', traits: { type: 'plain', clothes: 'frog', headphones: 'white' } },
  { id: 'jeans', category: 'bottoms', view: 'full', title: 'daily drivers', label: 'faded jeans', icon: '👖', caption: 'the same pair. every day.', note: 'faded denim, stitched pockets, and rolled hems.', color: '#dce5e9', traits: { type: 'plain', hair: 'messy_black', bottoms: 'jeans', headphones: 'red', prop: 'cigar' } },
  { id: 'cargo', category: 'bottoms', view: 'full', title: 'pockets for nothing', label: 'black cargos', icon: '▥', caption: 'fully equipped to do nothing.', note: 'roomy pockets and a clean cuff at the ankle.', color: '#e1e1d9', traits: { type: 'charcoal', hair: 'ponytail', clothes: 'collared_white', bottoms: 'cargo', headphones: 'white' } },
  { id: 'sport', category: 'bottoms', view: 'full', title: 'off the clock', label: 'track shorts', icon: 'Ⅱ', caption: 'training for absolutely nothing.', note: 'retro track shorts with contrast piping.', color: '#eadbd2', traits: { type: 'plain', bottoms: 'sport', headphones: 'white', prop: 'bubblegum' } },
  { id: 'utility', category: 'bottoms', view: 'full', title: 'touch grass fit', label: 'utility shorts', icon: '▧', caption: 'might go outside. might not.', note: 'sand-colored shorts with a little extra storage.', color: '#e6e2cf', traits: { type: 'plain', bottoms: 'utility', clothes: 'hoodie_down_pink', headphones: 'green' } },
  { id: 'axolotl', category: 'animals', view: 'laptop', title: 'axolotl questions', label: 'axolotl hoodie', icon: '✳', caption: 'no thoughts. just little gills.', note: 'pink fleece and branching gills, straight from the 2D art.', color: '#eddde5', traits: { clothes: 'axolotl', bottoms: 'sport', headphones: 'white' } },
  { id: 'rabbit', category: 'animals', view: 'laptop', title: 'some bunny', label: 'rabbit hoodie', icon: '♧', caption: 'ears up. responsibilities down.', note: 'long pink-lined ears and a tiny carrot detail.', color: '#e3e7d7', traits: { clothes: 'rabbit', bottoms: 'jeans', headphones: 'pink', prop: 'cig_black' } },
  { id: 'shark', category: 'animals', view: 'laptop', title: 'no bite', label: 'shark hoodie', icon: '△', caption: 'looks dangerous. mostly chills.', note: 'a charcoal shark hood, toothy opening, and dorsal fin.', color: '#dce4e9', traits: { type: 'charcoal', clothes: 'shark', bottoms: 'cargo', headphones: 'red' } },
  { id: 'fox', category: 'animals', view: 'laptop', title: 'a little sly', label: 'fox hoodie', icon: '♢', caption: 'up to something. probably nothing.', note: 'orange fleece, cream cheeks, and black-tipped ears.', color: '#eddfcf', traits: { clothes: 'fox', bottoms: 'utility', headphones: 'black' } },
];
for (const item of costumeCatalog) {
  presets.push({ ...item, title: item.label, view: 'laptop', traits: { clothes: item.id, headphones: item.headphones, bottoms: ['royal','snow_white'].includes(item.id) ? 'none' : 'cargo', ...item.traits } });
}
const costumeOptions = document.createElement('optgroup');
costumeOptions.label = 'themed hoodies + costumes';
for (const item of costumeCatalog) { const option = document.createElement('option'); option.value = item.id; option.textContent = item.label; costumeOptions.append(option); }
$('#clothes').append(costumeOptions);
const halloweenOrder = ['death', 'wicked_witch', 'plague_doctor', 'mlee'];
presets.sort((a, b) => {
  const rank = p => halloweenOrder.includes(p.id) ? halloweenOrder.indexOf(p.id) : halloweenOrder.length;
  return rank(a) - rank(b);
});
const initialPreset = presets.find(preset => preset.id === 'death');
let presetCategory = initialPreset.category || 'originals';
let selected = { ...baseline, ...initialPreset.traits }, currentPreset = initialPreset.id, expression = 'neutral';
let avatar, source, driver, mixer, addon, addonSource, addonPhysics, ready = false;
let commonBones = [], addonMeshes = [], baseMouths = [], baseEyes, head;
let expressionState = { open: 0, narrow: 0, cornerLeft: 0, cornerRight: 0, stretchLeft: 0, stretchRight: 0, shift: 0 };
let captureTracker = null, captureFrame = null, captureActive = false, captureLoading = false, captureEpoch = 0;
let elapsed = 0, bubbleStart = -Infinity, bubbleWeight = 0, bubblePhase = 'idle';
let cameraTransition = null, lastFrame = performance.now(), manualLookUntil = 0;
let cigarActiveProxy, postFaceProps;
const diagnostics = { loaded: false, addonLoaded: false, missingBones: [], errors: [] };

const canvas = $('#canvas'), wrap = $('#canvas-wrap');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const environmentScene = new RoomEnvironment();
const environment = pmrem.fromScene(environmentScene, .04);
scene.environment = environment.texture;
environmentScene.dispose(); pmrem.dispose();
const camera = new THREE.PerspectiveCamera(28, 1, .01, 30);
camera.position.set(-.82, 1.23, 1.82);
const orbit = new OrbitControls(camera, canvas);
orbit.target.set(0, 1, 0); orbit.enableDamping = true; orbit.dampingFactor = .07;
orbit.enablePan = false; orbit.minDistance = .55; orbit.maxDistance = 5; orbit.minPolarAngle = .15; orbit.maxPolarAngle = Math.PI * .82; orbit.autoRotateSpeed = .65;
orbit.addEventListener('start', () => { cameraTransition = null; manualLookUntil = elapsed + 1; });
scene.add(new THREE.HemisphereLight(0xffffff, 0xa4a899, 2));
const key = new THREE.DirectionalLight(0xfff5eb, 2.1); key.position.set(-3, 5, 4); scene.add(key);
const fill = new THREE.DirectionalLight(0xdde7ff, 1.1); fill.position.set(4, 2, -3); scene.add(fill);
const ground = new THREE.Mesh(new THREE.CircleGeometry(.58, 64), new THREE.MeshBasicMaterial({ color: '#6f7861', transparent: true, opacity: .035, depthWrite: false }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -.012; scene.add(ground);
const group = new THREE.Group(); scene.add(group);
const previewObservers = new Set();
function resize() { const { width, height } = wrap.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(wrap); resize();

function renderPresets() {
  $('#presets').innerHTML = presets.filter(p => (p.category || 'originals') === presetCategory).map(preset => `<button class="preset ${preset.id === currentPreset ? 'selected' : ''}" data-preset="${preset.id}" aria-pressed="${preset.id === currentPreset}"><span class="icon" aria-hidden="true">${preset.icon}</span><span class="name">${preset.label}</span><span class="number">${String(presets.indexOf(preset) + 1).padStart(2, '0')}</span></button>`).join('');
  document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === presetCategory)));
}
renderPresets();
$('#preset-categories').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (button) { presetCategory = button.dataset.category; renderPresets(); } });
$('#presets').addEventListener('click', event => {
  const button = event.target.closest('[data-preset]'); if (!button) return;
  setPreset(button.dataset.preset);
});
function setPreset(id) {
  const preset = presets.find(p => p.id === id); if (!preset) return;
  currentPreset = id; selected = { ...baseline, ...preset.traits }; bubbleStart = -Infinity;
  presetCategory = preset.category || 'originals'; renderPresets();
  $('#trait-title').textContent = preset.title; $('#trait-caption').textContent = preset.caption;
  const collection = presets.filter(p => (p.category || 'originals') === presetCategory);
  $('#counter').textContent = `${String(collection.indexOf(preset) + 1).padStart(2, '0')} / ${collection.length}`;
  $('.studio').style.background = preset.color;
  document.querySelectorAll('[data-preset]').forEach(button => { button.classList.toggle('selected', button.dataset.preset === id); button.setAttribute('aria-pressed', String(button.dataset.preset === id)); });
  if (id === 'eyes') setExpression('skeptical'); else setExpression('neutral');
  updateSelection(); setView(preset.view || (id === 'frog' ? 'laptop' : 'face'));
}
for (const key of Object.keys(baseline)) $(`#${key}`).addEventListener('change', event => {
  selected[key] = event.target.value;
  // Headwear must not slice through an exposed brain or occupy a ponytail's root.
  if (key === 'clothes' && animals.includes(selected.clothes)) { selected.type = selected.type === 'brain' ? 'plain' : selected.type; selected.hair = 'none'; }
  if ((key === 'type' && selected.type === 'brain') || (key === 'hair' && selected.hair !== 'none')) { if (animals.includes(selected.clothes)) selected.clothes = 'none'; }
  if (key === 'type' && selected.type === 'brain') selected.hair = 'none';
  if (key === 'hair' && selected.hair !== 'none' && selected.type === 'brain') selected.type = 'plain';
  document.querySelectorAll('[data-preset]').forEach(button => { button.classList.remove('selected'); button.setAttribute('aria-pressed', 'false'); });
  $('#trait-title').textContent = 'your kind of mfer'; $('#trait-caption').textContent = 'a little of this. a little of that.';
  updateSelection();
  if (key === 'bottoms' && selected.bottoms !== 'none') setView('full');
});
const addonTraitNames = new Set(['type_brain', 'brain_capsule', 'eyes_expressive', 'brows_expressive', 'hair_ponytail', 'smoke_cigar', 'bubblegum', ...animals.flatMap(animal => [`hoodie_${animal}`, `shirt_${animal}`]), ...bottoms.map(style => `bottoms_${style}`)]);
function traitFor(object) { for (let p = object; p && p !== addon; p = p.parent) if (addonTraitNames.has(p.name)) return p.name; return [...addonTraitNames].find(name => object.name.startsWith(`${name}_`)); }
function updateSelection() {
  for (const [key, value] of Object.entries(selected)) $(`#${key}`).value = value;
  // Give physical glass the stage backdrop in its transmission pass.
  scene.background = selected.type === 'brain' ? new THREE.Color($('.studio').style.backgroundColor || presets[0].color) : null;
  $('#bubble').disabled = selected.prop !== 'bubblegum' || !ready || !addon;
  if (!avatar) return;
  const base = { type: selected.type === 'brain' ? 'plain' : selected.type, eyes: 'regular', mouth: 'smile', headphones: selected.headphones, watch: 'oyster_silver' };
  if (selected.hair.startsWith('messy')) base.short_hair = selected.hair;
  if (selected.hair.startsWith('long')) base.long_hair = selected.hair;
  if (selected.prop === 'cig_black') base.smoke = 'cig_black';
  if (!animals.includes(selected.clothes) && selected.clothes !== 'none') base.shirt = selected.clothes;
  applyTraitVisibility(avatar, base);
  if (cigarActiveProxy) cigarActiveProxy.visible = selected.prop === 'cigar';
  if (addon) {
    if (selected.type === 'brain') avatar.getObjectByName('type_plain').visible = false;
    if (selected.eyes === 'expressive') for (const name of ['eyes_normal', 'eyes_metal', 'eyes_zombie']) { const object = avatar.getObjectByName(name); if (object) object.visible = false; }
    const show = new Set();
    if (selected.type === 'brain') { show.add('type_brain'); show.add('brain_capsule'); }
    if (selected.eyes === 'expressive') { show.add('eyes_expressive'); show.add('brows_expressive'); }
    if (selected.hair === 'ponytail') show.add('hair_ponytail');
    if (selected.prop === 'cigar') show.add('smoke_cigar');
    if (selected.prop === 'bubblegum') show.add('bubblegum');
    if (animals.includes(selected.clothes)) { show.add(`hoodie_${selected.clothes}`); show.add(`shirt_${selected.clothes}`); }
    if (bottoms.includes(selected.bottoms)) show.add(`bottoms_${selected.bottoms}`);
    for (const name of addonTraitNames) { const root = addon.getObjectByName(name); if (root) root.visible = show.has(name); }
    for (const mesh of addonMeshes) mesh.visible = show.has(traitFor(mesh));
    addonPhysics?.reset();
  }
  driver?.resetSecondaryMotion();
  postFaceProps?.reset();
}
function setExpression(value) { expression = value; document.querySelectorAll('[data-expression]').forEach(button => button.classList.toggle('selected', button.dataset.expression === value)); }
$('#expressions').addEventListener('click', event => { const button = event.target.closest('[data-expression]'); if (button) setExpression(button.dataset.expression); });
function setView(view) {
  const views = { face: { position: [-.42, 1.15, 1.17], target: [0, 1.01, 0] }, laptop: { position: [-.75, 1.23, 1.72], target: [0, .98, 0] }, full: { position: [-1.2, 1.14, 2.65], target: [0, .68, 0] } };
  const tall = ['wicked_witch', 'lobster', 'royal', 'plague_doctor', 'death', 'mlee'].includes(selected.clothes);
  const target = view === 'laptop' && tall ? { position: [-.85, 1.43, 1.98], target: [0, 1.065, 0] } : views[view]; if (!target) return;
  cameraTransition = { start: elapsed, from: camera.position.clone(), fromTarget: orbit.target.clone(), to: new THREE.Vector3(...target.position), target: new THREE.Vector3(...target.target) };
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('selected', button.dataset.view === view));
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$('#rotate').addEventListener('click', () => { orbit.autoRotate = !orbit.autoRotate; $('#rotate').setAttribute('aria-pressed', String(orbit.autoRotate)); });
$('#bubble').addEventListener('click', () => { if (selected.prop !== 'bubblegum' || !addon) return; bubbleStart = elapsed; setExpression('neutral'); });

$('#retry').addEventListener('click', () => location.reload());
const loader = new GLTFLoader();
async function loadBase() {
  try {
    source = await loader.loadAsync(`${import.meta.env.BASE_URL}avatar/mfermashup.glb`, event => { if (event.total) $('#progress').value = event.loaded / event.total * 100; });
    avatar = clone(source.scene); group.add(avatar);
    avatar.traverse(object => {
      if (object.isMesh) { object.frustumCulled = false; if (object.name.startsWith('mouth_') && object.morphTargetDictionary?.mouthStraighten !== undefined) baseMouths.push(object); }
    });
    baseEyes = avatar.getObjectByName('eyes_normal');
    head = avatar.getObjectByName('mixamorigHead') || avatar.getObjectByName('mixamorig:Head');
    // Let the existing vertex-sampled cigarette socket run for the new cigar.
    // This is a non-rendering activation node; the addon carries its own skinned mesh.
    cigarActiveProxy = new THREE.Object3D(); cigarActiveProxy.name = 'traitlab_cigar_socket_active'; cigarActiveProxy.visible = false; avatar.add(cigarActiveProxy);
    const cigarette = avatar.userData.mouthProps?.props?.find(prop => /Cigarette/i.test(prop.bone));
    cigarette?.meshes.push(cigarActiveProxy.name);
    driver = createAvatarDriver(avatar, source); mixer = new THREE.AnimationMixer(avatar);
    if (cigarette) postFaceProps = createMouthProps(avatar, { version: 1, props: [cigarette] });
    const idle = source.animations.find(clip => /idle/i.test(clip.name)) || source.animations[0]; if (idle) mixer.clipAction(idle).play();
    diagnostics.loaded = true;
    $('#loading-text').textContent = 'getting the costumes ready…';
    $('#progress').removeAttribute('value');
    await loadAddon();
    ready = true; updateSelection();
    $('#loading').hidden = true; $('#webcam').disabled = false; $('#download-glb').disabled = false;
    setView(presets.find(p => p.id === currentPreset)?.view || 'face');
  } catch (error) { diagnostics.errors.push(String(error)); $('#loading-text').textContent = 'Couldn’t load your mfer. Check your connection and try again.'; $('#retry').hidden = false; console.error(error); }
}
async function loadAddon() {
  try {
    addonSource = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/new-traits.glb`, event => { if (event.total) $('#progress').value = event.loaded / event.total * 100; });
    addon = clone(addonSource.scene); group.add(addon);
    const baseBones = new Map(); avatar.traverse(object => { if (object.isBone) baseBones.set(normalName(object.name), object); });
    addon.traverse(object => {
      if (object.isMesh) { object.frustumCulled = false; addonMeshes.push(object); }
      if (object.isBone && baseBones.has(normalName(object.name))) commonBones.push({ from: baseBones.get(normalName(object.name)), to: object });
    });
    // Parent-first conversion preserves the exporter's own armature root transform.
    commonBones.sort((a,b) => depth(a.to) - depth(b.to));
    diagnostics.commonBones = commonBones.length; diagnostics.addonMeshes = addonMeshes.map(mesh => mesh.name);
    diagnostics.addonLoaded = true; syncAddonSkeleton();
    const originalManifest = avatar.userData.mferSecondaryMotion || source.parser?.json?.extras?.mferSecondaryMotion;
    const garmentChains = (originalManifest?.chains || []).filter(chain => chain.meshes.includes('shirt_hoodie_up_green') || chain.meshes.includes('shirt_hoodie_green')).map(chain => ({ ...chain, meshes: [chain.meshes.includes('shirt_hoodie_up_green') ? 'hoodie_frog' : 'shirt_frog'] }));
    const manifest = addon.userData.mferSecondaryMotion || addonSource.parser?.json?.extras?.mferSecondaryMotion || {
      version: 1, chains: [...garmentChains, ...(buildInfo.accessories?.chains || [])],
      colliders: (originalManifest?.colliders || []).filter(collider => ['head','upper_back','pelvis'].includes(collider.id)),
    };
    if (manifest.chains?.length) { addonPhysics = createAvatarPhysics(addon, manifest); addonPhysics.setOptions({ wind: .22 }); }
    updateSelection();
  } catch (error) { throw error; }
}
function depth(node) { let n = 0; while (node.parent) { node = node.parent; n++; } return n; }
const inverse = new THREE.Matrix4(), local = new THREE.Matrix4();
function syncAddonSkeleton() {
  if (!addon) return;
  avatar.updateMatrixWorld(true); addon.updateMatrixWorld(true);
  for (const { from, to } of commonBones) {
    inverse.copy(to.parent.matrixWorld).invert(); local.multiplyMatrices(inverse, from.matrixWorld);
    local.decompose(to.position, to.quaternion, to.scale); to.updateMatrixWorld(true);
  }
}
function setMorph(mesh, name, weight, dt = 1, speed = 0) {
  const index = mesh.morphTargetDictionary?.[name]; if (index === undefined || !mesh.morphTargetInfluences) return;
  mesh.morphTargetInfluences[index] = speed ? smooth(mesh.morphTargetInfluences[index], clamp(weight), dt, speed) : clamp(weight);
}
function demoFace(dt) {
  if (captureActive) return;
  const pose = { open: 0, narrow: 0, cornerLeft: 0, cornerRight: 0, stretchLeft: 0, stretchRight: 0, shift: 0 };
  if (expression === 'happy') Object.assign(pose, { cornerLeft: 1, cornerRight: 1, stretchLeft: .24, stretchRight: .24 });
  if (expression === 'skeptical') Object.assign(pose, { cornerLeft: .72, cornerRight: -.63, shift: .16 });
  if (expression === 'surprise') Object.assign(pose, { open: .6, narrow: .48 });
  if (expression === 'talk') Object.assign(pose, { open: .1 + Math.pow(Math.sin(elapsed * 9.1), 2) * .48, narrow: Math.max(0, Math.sin(elapsed * 3.2)) * .45, cornerLeft: .4, cornerRight: .25, stretchLeft: Math.max(0, Math.sin(elapsed * 5)) * .27, stretchRight: Math.max(0, Math.sin(elapsed * 5)) * .27 });
  if (bubbleWeight > .01) { pose.open = .08; pose.narrow = .75; pose.cornerLeft = pose.cornerRight = 0; }
  for (const key of Object.keys(expressionState)) expressionState[key] = smooth(expressionState[key], pose[key], dt, 16);
  const weights = normalizeMouthFlexPose(expressionState);
  for (const mesh of baseMouths) { mesh.morphTargetInfluences.fill(0); for (const [name, weight] of Object.entries(weights)) setMorph(mesh, name, weight); }
}
function animateNewTraits(dt) {
  if (!addon) return;
  const scores = captureActive ? captureFrame?.face : null;
  const baseEyeWeights = Object.fromEntries(Object.entries(baseEyes?.morphTargetDictionary || {}).map(([name, index]) => [name, baseEyes.morphTargetInfluences[index]]));
  const eyeOpen = 1 - Math.max(baseEyeWeights.eyeBlinkLeft || 0, baseEyeWeights.eyeBlinkRight || 0);
  const brows = { browInnerUp: 0, browOuterUpLeft: 0, browOuterUpRight: 0, browDownLeft: 0, browDownRight: 0 };
  let wide = baseEyeWeights.eyeWide || 0, squintLeft = 0, squintRight = 0;
  if (scores) {
    for (const name of Object.keys(brows)) { const mirrored = name.endsWith('Left') ? name.replace(/Left$/, 'Right') : name.endsWith('Right') ? name.replace(/Right$/, 'Left') : name; brows[name] = clamp((scores[mirrored] || 0) * 1.6); }
    squintLeft = clamp((scores.eyeSquintRight || 0) * 1.4); squintRight = clamp((scores.eyeSquintLeft || 0) * 1.4);
  } else {
    if (expression === 'happy') { brows.browOuterUpLeft = brows.browOuterUpRight = .28; squintLeft = squintRight = .64; }
    if (expression === 'skeptical') { brows.browOuterUpLeft = 1; brows.browDownRight = .65; squintRight = .55; }
    if (expression === 'surprise') { brows.browInnerUp = .8; brows.browOuterUpLeft = brows.browOuterUpRight = .7; wide = .95; }
    if (expression === 'talk') { brows.browInnerUp = .12 + .2 * Math.max(0, Math.sin(elapsed * 2)); brows.browOuterUpLeft = .25 * Math.max(0, Math.sin(elapsed * 1.3)); }
  }
  const t = elapsed - bubbleStart;
  bubbleWeight = 0; bubblePhase = 'idle';
  if (selected.prop === 'bubblegum' && t >= 0 && t < 4.8) {
    if (t < 2.8) { bubbleWeight = THREE.MathUtils.smoothstep(t, 0, 2.8); bubblePhase = 'inflate'; }
    else if (t < 3.6) { bubbleWeight = 1; bubblePhase = 'hold'; }
    else { bubbleWeight = Math.max(0, 1 - (t - 3.6) / .12); bubblePhase = 'pop'; }
  }
  for (const mesh of addonMeshes) {
    const trait = traitFor(mesh);
    if (trait === 'eyes_expressive') {
      for (const name of ['eyeBlinkLeft','eyeBlinkRight','eyeLookUp','eyeLookDown','eyeLookLeft','eyeLookRight']) setMorph(mesh, name, baseEyeWeights[name] || 0);
      setMorph(mesh, 'eyeWide', wide, dt, 18); setMorph(mesh, 'eyeSquintLeft', squintLeft, dt, 18); setMorph(mesh, 'eyeSquintRight', squintRight, dt, 18);
      for (const [name, open] of [['eyeWide', eyeOpen], ['eyeSquintLeft', 1 - (baseEyeWeights.eyeBlinkLeft || 0)], ['eyeSquintRight', 1 - (baseEyeWeights.eyeBlinkRight || 0)]]) {
        const index = mesh.morphTargetDictionary?.[name]; if (index !== undefined) mesh.morphTargetInfluences[index] *= open;
      }
    }
    if (trait === 'brows_expressive') for (const [name, weight] of Object.entries(brows)) setMorph(mesh, name, weight, dt, 18);
    if (trait === 'type_brain') setMorph(mesh, 'brainWobble', .3 + .2 * Math.sin(elapsed * 2.6));
    if (trait === 'bubblegum') { setMorph(mesh, 'bubbleInflate', bubbleWeight); setMorph(mesh, 'bubblePop', bubblePhase === 'pop' ? clamp((t - 3.6) / .16) : 0); mesh.visible = selected.prop === 'bubblegum' && bubbleWeight > .006; }
  }
  $('#bubble').textContent = bubblePhase === 'inflate' ? 'a little bigger…' : bubblePhase === 'hold' ? 'any second…' : bubblePhase === 'pop' ? 'pop!' : 'blow a bubble ↗';
  diagnostics.bubbleWeight = bubbleWeight; diagnostics.bubblePhase = bubblePhase;
}

function stopCapture(message = '') {
  captureEpoch++; captureTracker?.stop(); captureTracker = null; captureActive = captureLoading = false; captureFrame = null;
  $('#webcam').textContent = '◉ try your webcam'; $('#capture').hidden = !message; $('#capture-status').textContent = message; $('#video').hidden = true; $('#calibrate').hidden = true;
}
$('#webcam').addEventListener('click', async () => {
  if (captureActive || captureLoading) { stopCapture(); return; }
  if (!ready) return;
  const generation = ++captureEpoch; captureLoading = true; $('#capture').hidden = false; $('#video').hidden = true; $('#calibrate').hidden = true;
  $('#capture-status').textContent = 'Allow camera access. Everything is processed in your browser.'; $('#webcam').textContent = 'cancel camera';
  const tracker = new CaptureTracker({ video: $('#video'), onFrame(frame) { if (captureEpoch === generation) captureFrame = frame; }, onStatus(status) {
    if (captureEpoch !== generation) return;
    if (status.state === 'error') stopCapture(status.message);
    else $('#capture-status').textContent = status.state === 'running' ? 'Face, body + hands. Raise your eyebrows, smile, or turn your head.' : status.message;
  } });
  captureTracker = tracker; tracker.setTongueEnabled(true);
  try {
    await tracker.start({ camera: true, microphone: false, mode: 'enhanced', hands: true });
    if (captureEpoch !== generation) { tracker.stop(); return; }
    captureLoading = false; captureActive = true; $('#video').hidden = false; $('#calibrate').hidden = false; $('#webcam').textContent = '■ stop webcam'; setView('laptop');
  } catch (error) { if (captureEpoch === generation) stopCapture(error.message || 'Camera could not start.'); }
});
$('#calibrate').addEventListener('click', () => { const ok = captureTracker?.calibrate() && driver?.calibrate(captureFrame); $('#capture-status').textContent = ok ? 'Neutral pose set. Make a face.' : 'Keep your face in view, then try again.'; });
window.addEventListener('pagehide', () => stopCapture());
document.addEventListener('visibilitychange', () => { if (document.hidden && (captureActive || captureLoading)) stopCapture(); });

function render(now) {
  const dt = Math.min((now - lastFrame) / 1000, .05); lastFrame = now; elapsed += dt;
  if (ready) {
    if (!captureActive) mixer.update(dt);
    driver.update(captureFrame, dt, { tracking: captureActive, now });
    demoFace(dt);
    postFaceProps?.update();
    if (!captureActive && head && elapsed > manualLookUntil) {
      head.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.025 * Math.sin(elapsed * .7), .055 * Math.sin(elapsed * .52), .015 * Math.sin(elapsed * .8))));
    }
    syncAddonSkeleton(); addonPhysics?.update(dt); animateNewTraits(dt);
  }
  if (cameraTransition) {
    const t = clamp((elapsed - cameraTransition.start) / .85), easing = t * t * (3 - 2 * t);
    camera.position.lerpVectors(cameraTransition.from, cameraTransition.to, easing); orbit.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.target, easing);
    if (t === 1) cameraTransition = null;
  }
  group.updateMatrixWorld(true);
  for (const observer of previewObservers) observer(now);
  orbit.update(); renderer.render(scene, camera); requestAnimationFrame(render);
}
$('#download-glb').addEventListener('click', async () => {
  if (!ready) return;
  const button = $('#download-glb'), status = $('#export-status');
  const controls = [...document.querySelectorAll('[data-preset], [data-category], .mix select')];
  const disabled = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  button.disabled = true; status.textContent = '';
  try {
    const data = await captureAnimatedPreview(group, {
      subscribe(observer) { previewObservers.add(observer); return () => previewObservers.delete(observer); },
      onProgress(progress) { button.textContent = `preparing… ${Math.round(progress * 100)}%`; },
      selection: { ...selected },
    });
    button.textContent = 'saving GLB…';
    const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
    const link = document.createElement('a');
    link.href = url; link.download = `mfer-lab-${selected.clothes === 'none' ? selected.type : selected.clothes}-animated.glb`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent = 'animated GLB ready';
  } catch (error) {
    console.error(error);
    status.textContent = error.message || 'Couldn’t prepare your GLB. Try again.';
  } finally {
    controls.forEach((control, index) => { control.disabled = disabled[index]; });
    button.disabled = false; button.textContent = 'download GLB ↓';
  }
});
// Read-only inspection helpers make it possible to validate local assets without camera permission.
window.traitLab = { diagnostics, setPreset, setView, setExpression, get selection() { return { ...selected }; }, get avatar() { return avatar; }, get addon() { return addon; }, get camera() { return camera; }, get controls() { return orbit; }, get driver() { return driver; }, get addonPhysics() { return addonPhysics; }, get captureActive() { return captureActive; }, get bubbleWeight() { return bubbleWeight; }, get renderer() { return renderer; } };
setPreset(initialPreset.id); requestAnimationFrame(render); loadBase();
