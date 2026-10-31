import assert from 'node:assert/strict';
import { AnimationMixer, Bone, BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { captureAnimatedPreview } from '../src/export-preview.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const root = new Group();
function rig(name, scale) {
  const group = new Group(); group.scale.setScalar(scale); root.add(group);
  const bone = new Bone(); bone.name = 'SharedJoint'; group.add(bone);
  const geometry = new BoxGeometry(.2,.3,.1), count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(Array.from({length: count * 4}, (_, i) => i % 4 === 0 ? 1 : 0), 4));
  geometry.morphAttributes.position = [new Float32BufferAttribute(new Float32Array(count * 3).fill(.025), 3)];
  geometry.morphTargetsRelative = true;
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial()); mesh.name = name;
  group.add(mesh); root.updateMatrixWorld(true); mesh.bind(new Skeleton([bone]));
  return {bone, mesh};
}
const base = rig('base_mesh', 1), addon = rig('addon_mesh', .7);
const hidden = new Mesh(new BoxGeometry(), new MeshStandardMaterial()); hidden.name = 'excluded_costume'; hidden.visible = false; root.add(hidden);
let sample, removed = false;
const originalPositions = addon.mesh.geometry.attributes.position.array.slice();
const promise = captureAnimatedPreview(root, {
  duration: 1, fps: 10,
  subscribe(callback) { sample = callback; return () => { removed = true; }; },
});
let expected;
for (let i = 0; i <= 10; i++) {
  const t = i / 10;
  base.bone.position.x = .2 * t;
  addon.bone.rotation.z = .3 * t;
  base.mesh.morphTargetInfluences[0] = .4 * t;
  root.updateMatrixWorld(true);
  if (i === 5) expected = addon.mesh.getVertexPosition(0, new Vector3()).applyMatrix4(addon.mesh.matrixWorld);
  sample(i * 100);
}
const buffer = await promise;
assert(removed, 'render subscription cleaned up');
assert.deepEqual(addon.mesh.geometry.attributes.position.array, originalPositions, 'live geometry unchanged');
const gltf = await new GLTFLoader().parseAsync(buffer, '');
assert.equal(gltf.scene.getObjectByName('excluded_costume'), undefined);
assert.equal(gltf.animations.length, 1);
assert(gltf.animations[0].tracks.some(track => track.name.includes('morphTargetInfluences')));
const exportedBase = gltf.scene.getObjectByName('base_mesh');
const exportedAddon = gltf.scene.getObjectByName('addon_mesh');
assert(exportedBase.isSkinnedMesh && exportedAddon.isSkinnedMesh);
assert.notEqual(exportedBase.skeleton.bones[0], exportedAddon.skeleton.bones[0]);
const mixer = new AnimationMixer(gltf.scene); mixer.clipAction(gltf.animations[0]).play(); mixer.setTime(.5);
gltf.scene.updateMatrixWorld(true);
const actual = exportedAddon.getVertexPosition(0, new Vector3()).applyMatrix4(exportedAddon.matrixWorld);
assert(actual.distanceTo(expected) < 1e-5, 'costume skin matches the displayed pose after re-import');
assert(Math.abs(exportedBase.skeleton.bones[0].position.x - .1) < 1e-5);
assert(Math.abs(exportedBase.morphTargetInfluences[0] - .2) < 1e-5);
console.log('PASS: selected meshes, independent base/costume skins, baked body + morph animation, round-trip vertex positions, live-source preservation, subscription cleanup.');
