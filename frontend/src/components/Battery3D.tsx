// src/components/Battery3D.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';

export interface Battery3DProps {
  chargeLevel: number; // 0.0 to 1.0
  temperatureC: number;
  cycleHorizon?: number; // 100 to 2000+
}

const COLOR_COLD = new THREE.Color('#3b82f6');    // Below 0°C -> Blue
const COLOR_NOMINAL = new THREE.Color('#22c55e'); // ~20-25°C -> Green
const COLOR_HOT = new THREE.Color('#f97316');     // 50°C+ -> Orange/Red

/**
 * Textures for positive (+) and negative (-) terminal signs
 */
function createSignTexture(sign: '+' | '-'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Circle background badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Polarity Sign
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = sign === '+' ? '#ef4444' : '#38bdf8';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText(sign, 64, sign === '+' ? 68 : 60);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
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

  // Reactive radial background glow
  const cardGradientStyle = useMemo(() => {
    let centerColor = 'rgba(241, 245, 249, 0.5)';

    if (temperatureC <= 20) {
      const t = Math.min(1, Math.max(0, (20 - temperatureC) / 40));
      centerColor = `rgba(186, 230, 253, ${0.15 + t * 0.45})`;
    } else {
      const t = Math.min(1, Math.max(0, (temperatureC - 20) / 45));
      centerColor = `rgba(254, 215, 170, ${0.18 + t * 0.55})`;
    }

    return {
      background: `radial-gradient(ellipse at 50% 50%, ${centerColor} 0%, rgba(255, 255, 255, 0.95) 72%, #ffffff 100%)`,
    };
  }, [temperatureC]);

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
    camera.position.set(0, 0.05, 5.7);

    // 2. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(3.5, 6, 4.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.65);
    fillLight.position.set(-3.5, -1, 3.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
    rimLight.position.set(0, -4, -2.5);
    scene.add(rimLight);

    const pointLight = new THREE.PointLight(0x22c55e, 2.4, 4.8);
    pointLight.position.set(0, 0, 0.3);
    scene.add(pointLight);

    // 4. Geometry & Assembly
    const totalHeight = 2.25;
    const outerRadius = 0.74;
    const innerRadius = 0.68;

    const group = new THREE.Group();
    group.position.set(0, -0.04, 0);
    scene.add(group);

    const terminalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.85,
    });

    const shinyMetalMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.2,
      metalness: 0.9,
    });

    // ================= TOP BUTTON TERMINAL =================
    const buttonNubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 32);
    const buttonNubMesh = new THREE.Mesh(buttonNubGeo, shinyMetalMat);
    buttonNubMesh.position.set(0, totalHeight / 2 + 0.13, 0);
    group.add(buttonNubMesh);

    const washerGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.05, 32);
    const washerMesh = new THREE.Mesh(washerGeo, terminalMat);
    washerMesh.position.set(0, totalHeight / 2 + 0.05, 0);
    group.add(washerMesh);

    const topRimGeo = new THREE.CylinderGeometry(outerRadius * 0.98, outerRadius, 0.07, 32);
    const topRimMesh = new THREE.Mesh(topRimGeo, terminalMat);
    topRimMesh.position.set(0, totalHeight / 2, 0);
    group.add(topRimMesh);

    // ================= BOTTOM FOOT TERMINAL =================
    const bottomFootGeo = new THREE.CylinderGeometry(outerRadius, outerRadius * 0.98, 0.09, 32);
    const bottomFootMesh = new THREE.Mesh(bottomFootGeo, terminalMat);
    bottomFootMesh.position.set(0, -totalHeight / 2 - 0.045, 0);
    group.add(bottomFootMesh);

    const bottomContactGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.03, 32);
    const bottomContactMesh = new THREE.Mesh(bottomContactGeo, shinyMetalMat);
    bottomContactMesh.position.set(0, -totalHeight / 2 - 0.095, 0);
    group.add(bottomContactMesh);

    // ================= INNER LIQUID =================
    const liquidGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, 1, 32);
    const liquidMat = new THREE.MeshStandardMaterial({
      color: COLOR_NOMINAL,
      emissive: COLOR_NOMINAL,
      emissiveIntensity: 0.55,
      roughness: 0.18,
      metalness: 0.12,
    });
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    liquidMesh.position.set(0, -totalHeight / 2, 0);
    group.add(liquidMesh);

    // ================= OUTER GLASS SHELL =================
    const glassGeo = new THREE.CylinderGeometry(outerRadius, outerRadius, totalHeight, 32);
    const glassMat = new THREE.MeshPhysicalMaterial({
      transmission: 0.82,
      transparent: true,
      opacity: 0.38,
      roughness: 0.09,
      ior: 1.48,
      thickness: 0.5,
      color: 0xffffff,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      depthWrite: false,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    group.add(glassMesh);

    // ================= EQUALLY SPACED CELL WRAPPING RINGS =================
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.35,
      metalness: 0.75,
      transparent: true,
      opacity: 0.65,
    });

    // 5 total rings: Top (+), 3 evenly spaced intermediate rings, Bottom (-)
    const ringPositions = [
      totalHeight * 0.36,   // Positive (+) ring
      totalHeight * 0.18,   // Upper mid ring
      0.0,                  // Center equator ring
      -totalHeight * 0.18,  // Lower mid ring
      -totalHeight * 0.36,  // Negative (-) ring
    ];

    const ringGeometries: THREE.TorusGeometry[] = [];
    ringPositions.forEach((yPos) => {
      const ringGeo = new THREE.TorusGeometry(outerRadius + 0.003, 0.0055, 12, 64);
      ringGeometries.push(ringGeo);
      const ringMesh = new THREE.Mesh(ringGeo, grooveMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(0, yPos, 0);
      group.add(ringMesh);
    });

    // ================= POSITIVE (+) & NEGATIVE (-) TERMINAL MARKINGS =================
    // Positive (+) Sign on top ring
    const plusTexture = createSignTexture('+');
    const plusGeo = new THREE.PlaneGeometry(0.24, 0.24);
    const plusMat = new THREE.MeshBasicMaterial({
      map: plusTexture,
      transparent: true,
    });
    const plusMesh = new THREE.Mesh(plusGeo, plusMat);
    plusMesh.position.set(0, totalHeight * 0.36, outerRadius + 0.02);
    group.add(plusMesh);

    // Negative (-) Sign on bottom ring
    const minusTexture = createSignTexture('-');
    const minusGeo = new THREE.PlaneGeometry(0.24, 0.24);
    const minusMat = new THREE.MeshBasicMaterial({
      map: minusTexture,
      transparent: true,
    });
    const minusMesh = new THREE.Mesh(minusGeo, minusMat);
    minusMesh.position.set(0, -totalHeight * 0.36, outerRadius + 0.02);
    group.add(minusMesh);

    // Degradation Particles
    const particleCount = 28;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * (totalHeight * 0.85);
      const r = outerRadius + 0.008;
      particlePositions[i * 3] = Math.cos(theta) * r;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = Math.sin(theta) * r;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x334155,
      size: 0.024,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const particleMesh = new THREE.Points(particleGeo, particleMat);
    group.add(particleMesh);

    // 5. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    const tempColor = new THREE.Color();
    const shellTint = new THREE.Color();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const { chargeLevel: fill, temperatureC: temp, cycleHorizon: cycles } = stateRef.current;

      // Color Interpolation
      if (temp <= 20) {
        const t = Math.min(1, Math.max(0, (temp - (-20)) / (20 - (-20))));
        tempColor.lerpColors(COLOR_COLD, COLOR_NOMINAL, t);
      } else {
        const t = Math.min(1, Math.max(0, (temp - 20) / (65 - 20)));
        tempColor.lerpColors(COLOR_NOMINAL, COLOR_HOT, t);
      }

      liquidMat.color.copy(tempColor);
      liquidMat.emissive.copy(tempColor);
      pointLight.color.copy(tempColor);

      // Degradation Aging Effect tied to cycleHorizon
      const degFactor = Math.min(1.0, Math.max(0.0, (cycles - 100) / 1900));
      shellTint.setRGB(1.0 - degFactor * 0.12, 1.0 - degFactor * 0.14, 1.0 - degFactor * 0.18);
      glassMat.color.copy(shellTint);
      glassMat.roughness = 0.09 + degFactor * 0.16;
      particleMat.opacity = degFactor * 0.38;

      // Liquid Meniscus Bobbing
      const clampedFill = Math.min(1.0, Math.max(0.04, fill));
      const wave = Math.sin(time * 2.2) * 0.016;
      const targetHeight = Math.max(0.06, (totalHeight - 0.08) * clampedFill + wave);

      liquidMesh.scale.set(1, targetHeight, 1);
      liquidMesh.position.y = -totalHeight / 2 + targetHeight / 2;

      renderer.render(scene, camera);
    };

    animate();

    // 6. Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      liquidGeo.dispose();
      glassGeo.dispose();
      buttonNubGeo.dispose();
      washerGeo.dispose();
      topRimGeo.dispose();
      bottomFootGeo.dispose();
      bottomContactGeo.dispose();
      plusGeo.dispose();
      plusTexture.dispose();
      minusGeo.dispose();
      minusTexture.dispose();
      particleGeo.dispose();
      ringGeometries.forEach((g) => g.dispose());
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={cardGradientStyle}
      className="w-full h-full relative select-none pointer-events-none rounded-[22px] transition-all duration-700 ease-out overflow-hidden"
    />
  );
};