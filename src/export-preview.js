import { AnimationClip, NumberKeyframeTrack, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

function isVisible(node) {
  for (let parent = node; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}

/** Bake the displayed pose, both rigs, expressions and spring motion into core glTF tracks. */
export async function captureAnimatedPreview(root, {
  subscribe, onProgress = () => {}, selection = {}, duration = 6, fps = 30,
  visibilityTarget = typeof document === 'undefined' ? null : document,
} = {}) {
  const model = clone(root), originals = [], copies = [];
  root.traverse(node => originals.push(node));
  model.traverse(node => copies.push(node));
  const pairs = originals.map((source, index) => ({ source, copy: copies[index] }));
  const geometries = new Set(), materials = new Set(), skeletons = new Set();
  const selectedMeshes = [];
  for (const { source, copy } of pairs) {
    copy.userData = {};
    if (copy.isSkinnedMesh) skeletons.add(copy.skeleton);
    if (!copy.isMesh) continue;
    if (!isVisible(source) && source.name !== 'tongue') { copy.removeFromParent(); continue; }
    selectedMeshes.push(source.name);
    copy.geometry = copy.geometry.clone(); geometries.add(copy.geometry);
    const copyMaterial = material => {
      const isolated = material.clone(); materials.add(isolated); return isolated;
    };
    copy.material = Array.isArray(copy.material) ? copy.material.map(copyMaterial) : copyMaterial(copy.material);
  }
  model.traverse(node => { node.visible = true; });
  const included = new Set(); model.traverse(node => included.add(node));
  const channels = [];
  for (const { source, copy } of pairs) {
    if (!included.has(copy)) continue;
    const channel = (property, Type, read) => channels.push({ source, copy, property, Type, read, values: [] });
    channel('position', VectorKeyframeTrack, node => node.position.toArray());
    channel('quaternion', QuaternionKeyframeTrack, node => node.quaternion.toArray());
    channel('scale', VectorKeyframeTrack, node => node.scale.toArray());
    if (copy.morphTargetInfluences?.length) channel('morphTargetInfluences', NumberKeyframeTrack, node => [...node.morphTargetInfluences]);
  }
  const times = [];
  try {
    await new Promise((resolve, reject) => {
      let start, last = -Infinity, unsubscribe = () => {}, finished = false;
      const cleanup = () => { unsubscribe(); visibilityTarget?.removeEventListener('visibilitychange', hidden); };
      const finish = error => {
        if (finished) return;
        finished = true; cleanup();
        if (error) reject(error); else resolve();
      };
      const hidden = () => {
        if (visibilityTarget.hidden) finish(new Error('Keep this tab open while preparing your GLB.'));
      };
      visibilityTarget?.addEventListener('visibilitychange', hidden);
      unsubscribe = subscribe(now => {
        if (finished) return;
        try {
          start ??= now;
          const time = Math.min(duration, (now - start) / 1000);
          if (time < last + 1 / fps && time < duration) return;
          last = time; times.push(time);
          for (const channel of channels) channel.values.push(...channel.read(channel.source));
          onProgress(time / duration);
          if (time >= duration) finish();
        } catch (error) { finish(error); }
      });
    });
    const tracks = [], loopEnd = duration + .35;
    for (const { copy, property, Type, values } of channels) {
      const size = values.length / times.length;
      if (!values.some((value, index) => Math.abs(value - values[index % size]) > 1e-6)) continue;
      // UUID targets keep the base and costume joints distinct even when their names match.
      tracks.push(new Type(`${copy.uuid}.${property}`, [...times, loopEnd], [...values, ...values.slice(0, size)]));
    }
    model.name = 'MferLabAvatar';
    model.userData = { mferLab: { selection, selectedMeshes, animation: 'Lab preview', baked: true } };
    model.updateMatrixWorld(true);
    return await new GLTFExporter().parseAsync(model, {
      binary: true, onlyVisible: false, trs: true,
      animations: [new AnimationClip('Lab preview', loopEnd, tracks)],
    });
  } finally {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const skeleton of skeletons) skeleton.dispose();
  }
}
