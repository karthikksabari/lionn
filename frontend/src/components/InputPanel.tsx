// src/components/Battery3D.tsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface Battery3DProps {
  chargeLevel: number; // 0.0 to 1.0
  temperatureC: number;
  cycleHorizon?: number; // 100 to 2000+
}

// Clean temperature color stops
const COLOR_FROST_BLUE = new THREE.Color('#0284c7');  // Sub-zero Ice Blue (< 0°C)
const COLOR_CYAN       = new THREE.Color('#06b6d4');  // Cool Cyan (10°C)
const COLOR_EMERALD    = new THREE.Color('#10b981');  // Optimal Emerald Green (25°C)
const COLOR_AMBER      = new THREE.Color('#f59e0b');  // Warm Amber (42°C)
const COLOR_RED        = new THREE.Color('#ef4444');  // Hot Crimson Red (55°C+)

/**
 * Generates an internal studio environment map so chrome and silver surfaces
 * always reflect bright white/soft-slate studio lighting rather than black.
 */
function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#ffffff');

  // Studio overhead softbox
  const light1 = new THREE.DirectionalLight(0xffffff, 4.0);
  light1.position.set(0, 10, 0);
  envScene.add(light1);

  // Key and fill lights for side specular highlights
  const light2 = new THREE.DirectionalLight(0xe0f2fe, 3.0);
  light2.position.set(5, 3, 5);
  envScene.add(light2);

  const light3 = new THREE.DirectionalLight(0xffffff, 2.5);
  light3.position.set(-5, 2, -5);
  envScene.add(light3);

  const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
  pmremGenerator.dispose();
  return renderTarget;
}

/**
 * Creates the exact, crisp 3D lightning bolt geometry from the reference
 */
function createReferenceLightningGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // Precise contour matching the reference graphic
  shape.moveTo(0.06, 0.62);     // Top apex
  shape.lineTo(-0.24, 0.02);    // Upper inner angle
  shape.lineTo(-0.03, 0.02);    // Center shelf
  shape.lineTo(-0.18, -0.62);   // Bottom point
  shape.lineTo(0.24, -0.02);    // Lower outer angle
  shape.lineTo(0.03, -0.02);    // Lower shelf
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.014,
    bevelThickness: 0.016,
  });
}

export const Battery3D: React.FC<Battery3DProps> = ({
  chargeLevel,
  temperatureC,
  cycleHorizon = 1000,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ chargeLevel, temperatureC, cycleHorizon });

  useEffect(() => {
    stateRef.current = { chargeLevel, temperatureC, cycleHorizon };
  }, [chargeLevel, temperatureC, cycleHorizon]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.05, 5.2);

    // 2. WebGL Renderer with High-Luminance Tonemapping
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Studio Environment Map for Chrome Reflection
    const studioEnv = createStudioEnvironment(renderer);
    scene.environment = studioEnv.texture;

    // 4. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf0f9ff, 1.8);
    fillLight.position.set(-4, 0, 4);
    scene.add(fillLight);

    const bottomBounce = new THREE.DirectionalLight(0xffffff, 1.2);
    bottomBounce.position.set(0, -4, 2);
    scene.add(bottomBounce);

    const internalLight = new THREE.PointLight(0x10b981, 3.2, 5.0);
    internalLight.position.set(0, 0, 0.4);
    scene.add(internalLight);

    // 5. 3D Studio Stage Floor & Background
    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    // Pedestal floor disk
    const plinthGeo = new THREE.CylinderGeometry(1.4, 1.55, 0.12, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.05,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.set(0, -1.34, 0);
    plinthMesh.receiveShadow = true;
    stageGroup.add(plinthMesh);

    // Soft drop shadow
    const shadowGeo = new THREE.RingGeometry(0.15, 0.95, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = Math.PI / 2;
    shadowMesh.position.set(0, -1.27, 0);
    stageGroup.add(shadowMesh);

    // 6. Battery Geometry & Chrome Assembly
    const totalHeight = 2.15;
    const outerRadius = 0.78;
    const innerRadius = 0.73;

    const batteryGroup = new THREE.Group();
    batteryGroup.position.set(0, -0.05, 0);
    scene.add(batteryGroup);

    // Bright White Polished Silver/Chrome Material
    const brightSilverMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.85,
      roughness: 0.15,
      emissive: 0x333333,
      emissiveIntensity: 0.15,
    });

    // Top Terminal Positive Button Nub
    const nubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 32);
    const nubMesh = new THREE.Mesh(nubGeo, brightSilverMat);
    nubMesh.position.set(0, totalHeight / 2 + 0.18, 0);
    nubMesh.castShadow = true;
    batteryGroup.add(nubMesh);

    // Top Stepped Washer
    const washerGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.06, 32);
    const washerMesh = new THREE.Mesh(washerGeo, brightSilverMat);
    washerMesh.position.set(0, totalHeight / 2 + 0.09, 0);
    batteryGroup.add(washerMesh);

    // Top Bright Silver Cap
    const topCapGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, 0.22, 48);
    const topCapMesh = new THREE.Mesh(topCapGeo, brightSilverMat);
    topCapMesh.position.set(0, totalHeight / 2, 0);
    topCapMesh.castShadow = true;
    batteryGroup.add(topCapMesh);

    // Bottom Bright Silver Base
    const bottomCapGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, 0.22, 48);
    const bottomCapMesh = new THREE.Mesh(bottomCapGeo, brightSilverMat);
    bottomCapMesh.position.set(0, -totalHeight / 2, 0);
    bottomCapMesh.castShadow = true;
    batteryGroup.add(bottomCapMesh);

    // Inner Liquid Core
    const liquidGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, 1, 32);
    const liquidMat = new THREE.MeshStandardMaterial({
      color: COLOR_EMERALD,
      emissive: COLOR_EMERALD,
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.05,
    });
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    liquidMesh.position.set(0, -totalHeight / 2, 0);
    batteryGroup.add(liquidMesh);

    // Outer Glass Sleeve with Highlight Streak
    const glassGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, totalHeight - 0.2, 48);
    const glassMat = new THREE.MeshPhysicalMaterial({
      transmission: 0.92,
      transparent: true,
      opacity: 0.35,
      roughness: 0.04,
      ior: 1.48,
      thickness: 0.45,
      color: 0xffffff,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      depthWrite: false,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.castShadow = true;
    batteryGroup.add(glassMesh);

    // Exact Silver Beveled Lightning Bolt Emblem
    const lightningGeo = createReferenceLightningGeometry();
    const lightningMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.95,
      roughness: 0.12,
      emissive: 0xffffff,
      emissiveIntensity: 0.35,
    });
    const lightningMesh = new THREE.Mesh(lightningGeo, lightningMat);
    lightningMesh.scale.set(1.08, 1.08, 1.08);
    lightningMesh.position.set(0, 0, outerRadius + 0.038);
    lightningMesh.castShadow = true;
    batteryGroup.add(lightningMesh);

    // 7. Interactive Parallax Handling
    let targetRotY = 0;
    let targetRotX = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotY = x * 0.35;
      targetRotX = y * 0.2;
    };
    container.addEventListener('mousemove', handleMouseMove);

    // 8. Animation & Clean Color Transition Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    const activeColor = new THREE.Color();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const { chargeLevel: fill, temperatureC: temp } = stateRef.current;

      // Multi-stop clean progression: Frost Blue -> Cyan -> Emerald Green -> Amber -> Racing Red
      if (temp <= 5) {
        const t = Math.min(1, Math.max(0, (temp - (-20)) / (5 - (-20))));
        activeColor.lerpColors(COLOR_FROST_BLUE, COLOR_CYAN, t);
      } else if (temp <= 25) {
        const t = (temp - 5) / (25 - 5);
        activeColor.lerpColors(COLOR_CYAN, COLOR_EMERALD, t);
      } else if (temp <= 45) {
        const t = (temp - 25) / (45 - 25);
        activeColor.lerpColors(COLOR_EMERALD, COLOR_AMBER, t);
      } else {
        const t = Math.min(1, (temp - 45) / (65 - 45));
        activeColor.lerpColors(COLOR_AMBER, COLOR_RED, t);
      }

      liquidMat.color.copy(activeColor);
      liquidMat.emissive.copy(activeColor);
      internalLight.color.copy(activeColor);

      // Fluid Fill Scale & Wave Motion
      const clampedFill = Math.min(1.0, Math.max(0.06, fill));
      const wave = Math.sin(time * 2.2) * 0.014;
      const targetHeight = Math.max(0.08, (totalHeight - 0.22) * clampedFill + wave);

      liquidMesh.scale.set(1, targetHeight, 1);
      liquidMesh.position.y = -totalHeight / 2 + 0.1 + targetHeight / 2;

      // Smooth Parallax Sway
      batteryGroup.rotation.y += (targetRotY - batteryGroup.rotation.y) * 0.08;
      batteryGroup.rotation.x += (targetRotX - batteryGroup.rotation.x) * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize & Cleanup
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      studioEnv.dispose();
      renderer.dispose();
      plinthGeo.dispose();
      shadowGeo.dispose();
      nubGeo.dispose();
      washerGeo.dispose();
      topCapGeo.dispose();
      bottomCapGeo.dispose();
      liquidGeo.dispose();
      glassGeo.dispose();
      lightningGeo.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative cursor-grab active:cursor-grabbing rounded-[28px] overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 35%, #ffffff 0%, #f8fafc 55%, #e2e8f0 100%)',
      }}
    />
  );
};