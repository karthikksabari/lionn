// src/components/Battery3D.tsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface Battery3DProps {
  chargeLevel: number; // 0.0 to 1.0
  temperatureC: number;
  cycleHorizon?: number; // 100 to 2000+
}

const COLOR_FROST = new THREE.Color('#0284c7');   // Sub-zero deep ice blue (< 0°C)
const COLOR_SKY = new THREE.Color('#38bdf8');     // Optimal electric sky blue (20-25°C)
const COLOR_HOT = new THREE.Color('#ef4444');     // High temp vivid crimson red (50-65°C)

/**
 * Generates an extruded 3D Lightning Bolt Shape
 */
function createLightningGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // Lightning bolt vector polygon path
  shape.moveTo(0.04, 0.55);
  shape.lineTo(-0.22, 0.05);
  shape.lineTo(-0.02, 0.05);
  shape.lineTo(-0.16, -0.55);
  shape.lineTo(0.24, -0.05);
  shape.lineTo(0.02, -0.05);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.015,
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

    // 1. 3D Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.1, 5.2);

    // 2. High Quality Renderer with Shadows
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. 3D Room / Depth Stage Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(3.5, 6, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.8);
    fillLight.position.set(-4, -1, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.9);
    rimLight.position.set(0, 4, -3);
    scene.add(rimLight);

    // Internal reactive point light
    const internalLight = new THREE.PointLight(0x38bdf8, 2.5, 4.5);
    internalLight.position.set(0, 0, 0.3);
    scene.add(internalLight);

    // 4. 3D Spatial Room Environment (3D Stage Background)
    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    // Cylindrical floating stage base
    const stageBaseGeo = new THREE.CylinderGeometry(1.3, 1.45, 0.16, 48);
    const stageBaseMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.2,
    });
    const stageBaseMesh = new THREE.Mesh(stageBaseGeo, stageBaseMat);
    stageBaseMesh.position.set(0, -1.35, 0);
    stageBaseMesh.receiveShadow = true;
    stageGroup.add(stageBaseMesh);

    // Deep curved reflector dome behind the cell
    const backdropGeo = new THREE.CylinderGeometry(4.2, 4.2, 5.5, 32, 1, true, -Math.PI / 2, Math.PI);
    const backdropMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.BackSide,
    });
    const backdropMesh = new THREE.Mesh(backdropGeo, backdropMat);
    backdropMesh.position.set(0, 0.4, -0.6);
    backdropMesh.receiveShadow = true;
    stageGroup.add(backdropMesh);

    // 5. Exact Battery Reference Geometry
    const totalHeight = 2.15;
    const outerRadius = 0.78;
    const innerRadius = 0.73;

    const batteryGroup = new THREE.Group();
    batteryGroup.position.set(0, -0.05, 0);
    scene.add(batteryGroup);

    // Polished Silver Aluminum Metal Material for Caps & Nub
    const chromeMetalMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.95,
      roughness: 0.18,
    });

    // Dark collar insulator band
    const darkCollarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.7,
      roughness: 0.35,
    });

    // --- TOP CHROME TERMINAL ASSEMBLY ---
    // Raised Positive Button Nub
    const nubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 32);
    const nubMesh = new THREE.Mesh(nubGeo, chromeMetalMat);
    nubMesh.position.set(0, totalHeight / 2 + 0.18, 0);
    nubMesh.castShadow = true;
    batteryGroup.add(nubMesh);

    const washerGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.06, 32);
    const washerMesh = new THREE.Mesh(washerGeo, darkCollarMat);
    washerMesh.position.set(0, totalHeight / 2 + 0.09, 0);
    batteryGroup.add(washerMesh);

    // Chunky Top Chrome Cap with Rounded Bevel
    const topCapGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, 0.22, 48);
    const topCapMesh = new THREE.Mesh(topCapGeo, chromeMetalMat);
    topCapMesh.position.set(0, totalHeight / 2, 0);
    topCapMesh.castShadow = true;
    batteryGroup.add(topCapMesh);

    // --- BOTTOM CHROME FOOT ASSEMBLY ---
    const bottomCapGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, 0.22, 48);
    const bottomCapMesh = new THREE.Mesh(bottomCapGeo, chromeMetalMat);
    bottomCapMesh.position.set(0, -totalHeight / 2, 0);
    bottomCapMesh.castShadow = true;
    batteryGroup.add(bottomCapMesh);

    // --- INNER FLUID CORE ---
    const liquidGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, 1, 32);
    const liquidMat = new THREE.MeshStandardMaterial({
      color: COLOR_SKY,
      emissive: COLOR_SKY,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.1,
    });
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    liquidMesh.position.set(0, -totalHeight / 2, 0);
    batteryGroup.add(liquidMesh);

    // --- CLEAR OUTER GLASS CASING ---
    const glassGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, totalHeight - 0.2, 48);
    const glassMat = new THREE.MeshPhysicalMaterial({
      transmission: 0.9,
      transparent: true,
      opacity: 0.4,
      roughness: 0.05,
      ior: 1.48,
      thickness: 0.5,
      color: 0xffffff,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.castShadow = true;
    batteryGroup.add(glassMesh);

    // --- 3D BEVELED SILVER LIGHTNING BOLT EMBLEM ---
    const lightningGeo = createLightningGeometry();
    const lightningMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.95,
      roughness: 0.14,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
    });
    const lightningMesh = new THREE.Mesh(lightningGeo, lightningMat);
    lightningMesh.scale.set(1.05, 1.05, 1.05);
    lightningMesh.position.set(0, 0, outerRadius + 0.035);
    lightningMesh.castShadow = true;
    batteryGroup.add(lightningMesh);

    // 6. Interactive 3D Spatial Parallax Tracking
    let targetRotY = 0;
    let targetRotX = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotY = x * 0.4;
      targetRotX = y * 0.25;
    };
    container.addEventListener('mousemove', handleMouseMove);

    // 7. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    const activeColor = new THREE.Color();
    const bgGradientColor = new THREE.Color();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const { chargeLevel: fill, temperatureC: temp } = stateRef.current;

      // Color Progression: Sub-zero frost blue (< 0°C) -> Electric Sky Blue (20-25°C) -> Vivid Crimson Red (50-65°C)
      if (temp <= 20) {
        const t = Math.min(1, Math.max(0, (temp - (-20)) / (20 - (-20))));
        activeColor.lerpColors(COLOR_FROST, COLOR_SKY, t);
      } else {
        const t = Math.min(1, Math.max(0, (temp - 20) / (65 - 20)));
        activeColor.lerpColors(COLOR_SKY, COLOR_HOT, t);
      }

      liquidMat.color.copy(activeColor);
      liquidMat.emissive.copy(activeColor);
      internalLight.color.copy(activeColor);

      // Environment Light & Stage Tinting
      if (temp >= 40) {
        const heatFactor = Math.min(1.0, (temp - 40) / 25);
        bgGradientColor.setRGB(1.0, 0.94 - heatFactor * 0.2, 0.94 - heatFactor * 0.2);
      } else if (temp <= 0) {
        const coldFactor = Math.min(1.0, -temp / 20);
        bgGradientColor.setRGB(0.92 - coldFactor * 0.1, 0.96, 1.0);
      } else {
        bgGradientColor.setRGB(0.97, 0.98, 1.0);
      }
      backdropMat.color.copy(bgGradientColor);

      // Liquid Fill Scale & Meniscus Motion
      const clampedFill = Math.min(1.0, Math.max(0.06, fill));
      const wave = Math.sin(time * 2.2) * 0.015;
      const targetHeight = Math.max(0.08, (totalHeight - 0.22) * clampedFill + wave);

      liquidMesh.scale.set(1, targetHeight, 1);
      liquidMesh.position.y = -totalHeight / 2 + 0.1 + targetHeight / 2;

      // Gentle interactive 3D camera/battery sway
      batteryGroup.rotation.y += (targetRotY - batteryGroup.rotation.y) * 0.08;
      batteryGroup.rotation.x += (targetRotX - batteryGroup.rotation.x) * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    // 8. Resize Handler
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
      renderer.dispose();
      stageBaseGeo.dispose();
      backdropGeo.dispose();
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
      className="w-full h-full relative cursor-grab active:cursor-grabbing rounded-[24px] overflow-hidden"
    />
  );
};