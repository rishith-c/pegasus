// Brain3D — real 3D brain from synapse's fsaverage5.glb (FreeSurfer surface),
// rendered with expo-gl + expo-three, tinted by TRIBE region activation.
//
// Lifecycle-safe (fixes the prior GL/RAF leak): ONE render loop, the GLView is
// NOT re-keyed on region change — instead we recolor the loaded mesh imperatively
// via a ref. On any GL/asset failure we fall back to a procedural point-cloud
// brain so the screen never crashes. Not runtime-verified here (needs a device).
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer, THREE } from "expo-three";
import { Asset } from "expo-asset";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { BrainData } from "../types";
import { COLORS } from "../utils/colors";

type Regions = BrainData["regions"];

// activation 0..1 -> blue (#3b82f6) -> yellow (#eab308) -> red (#ef4444)
function activationColor(a: number): THREE.Color {
  const c = new THREE.Color();
  const t = Math.max(0, Math.min(1, a));
  if (t < 0.5) c.lerpColors(new THREE.Color("#3b82f6"), new THREE.Color("#eab308"), t * 2);
  else c.lerpColors(new THREE.Color("#eab308"), new THREE.Color("#ef4444"), (t - 0.5) * 2);
  return c;
}

function meanActivation(regions?: Regions): number {
  if (!regions) return 0.3;
  const vals = Object.values(regions).map((v) => Number(v) || 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.3;
}

export default function Brain3D({ regions, size = 280 }: { regions?: Regions; size?: number }) {
  const [failed, setFailed] = useState(false);
  const meshRef = useRef<THREE.Object3D | null>(null);
  const frameRef = useRef<number | null>(null);
  const rendererRef = useRef<Renderer | null>(null);

  // Recolor imperatively when regions change — NO remount, no new GL context.
  useEffect(() => {
    const obj = meshRef.current;
    if (!obj) return;
    const color = activationColor(meanActivation(regions));
    obj.traverse((child: any) => {
      if (child.isMesh && child.material) {
        child.material.color = color;
        if ("emissive" in child.material) child.material.emissive = color.clone().multiplyScalar(0.25);
      }
      if (child.isPoints && child.material) child.material.color = color;
    });
  }, [regions]);

  // Cleanup on unmount only.
  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      try {
        rendererRef.current?.dispose?.();
      } catch {}
    };
  }, []);

  async function onContextCreate(gl: ExpoWebGLRenderingContext) {
    try {
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(COLORS.bg as any, 1);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100);
      camera.position.set(0, 0, 3.2);
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const dir = new THREE.DirectionalLight(0xffffff, 0.6);
      dir.position.set(2, 3, 4);
      scene.add(dir);

      const root = new THREE.Group();
      scene.add(root);
      meshRef.current = root;

      // Try the real fsaverage5.glb; fall back to a procedural brain.
      try {
        const asset = Asset.fromModule(require("../../assets/brain/fsaverage5.glb"));
        await asset.downloadAsync();
        const gltf: any = await new Promise((resolve, reject) =>
          new GLTFLoader().load(asset.localUri || asset.uri, resolve, undefined, reject)
        );
        const brain = gltf.scene;
        const box = new THREE.Box3().setFromObject(brain);
        const center = box.getCenter(new THREE.Vector3());
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        brain.position.sub(center);
        brain.scale.setScalar(1.6 / (sphere.radius || 1));
        brain.traverse((c: any) => {
          if (c.isMesh) {
            c.material = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6, metalness: 0.1 });
          }
        });
        root.add(brain);
      } catch {
        root.add(proceduralBrain());
      }

      const color = activationColor(meanActivation(regions));
      root.traverse((c: any) => {
        if (c.material) c.material.color = color;
      });

      const render = () => {
        frameRef.current = requestAnimationFrame(render);
        root.rotation.y += 0.006;
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      render();
    } catch {
      setFailed(true);
    }
  }

  if (failed) {
    return (
      <View style={[styles.fallback, { width: size, height: size }]}>
        <Text style={styles.fallbackText}>brain view unavailable</Text>
      </View>
    );
  }
  return <GLView style={{ width: size, height: size }} onContextCreate={onContextCreate} />;
}

// Procedural two-hemisphere point cloud (fallback if the glb won't load).
function proceduralBrain(): THREE.Points {
  const N = 4000;
  const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    const noise = 0.92 + Math.random() * 0.16;
    let x = 1.0 * Math.sin(v) * Math.cos(u) * noise;
    const y = 0.8 * Math.sin(v) * Math.sin(u) * noise;
    const z = 1.1 * Math.cos(v) * noise;
    x += x >= 0 ? 0.12 : -0.12; // longitudinal fissure gap
    positions.set([x, y, z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x3b82f6, size: 0.02 }));
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  fallbackText: { color: COLORS.textDim, fontSize: 13 },
});
