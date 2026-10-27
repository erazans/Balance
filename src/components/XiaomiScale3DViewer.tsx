import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { XiaomiScaleModel } from '../types';
import { ChevronDown, ChevronUp, RotateCcw, Layers, Eye, Sparkles } from 'lucide-react';

interface XiaomiScale3DViewerProps {
  selectedModel: XiaomiScaleModel;
  onSelectModel: (model: XiaomiScaleModel) => void;
  currentWeightKg: number;
  currentBmi: number;
  impedanceOhm?: number;
  onQuickWeighIn: () => void;
}

type FinishPreset = 'obsidian' | 'ceramic' | 'titanium';
type CameraPreset = 'iso' | 'top' | 'side' | 'display';

// Module-scope reusable math helpers for Zero-GC in the animation loop
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

function createLedDisplayTexture(
  weightKg: number,
  bmi: number,
  impedanceOhm: number | undefined,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep OLED matrix background
  ctx.fillStyle = '#030706';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle LED matrix grid
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y < 256; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Border frame
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 240);

  // Top telemetry status row
  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('BLE 5.0 · GATT 0x181B', 28, 42);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText(`BIA ${impedanceOhm ?? 478} Ω`, 484, 42);

  // Main weight readout
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 104px "JetBrains Mono", monospace';
  ctx.fillText(`${weightKg.toFixed(1)}`, 230, 152);

  ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#10B981';
  ctx.fillText('kg', 418, 148);

  // Bottom BMI & stabilized bar
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#A1A1AA';
  ctx.fillText(`IMC ${bmi.toFixed(1)}  ·  STABILISÉ ±50g`, 256, 216);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

function createBrushedMetalBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 900; i++) {
    const y = Math.random() * 256;
    const shade = Math.floor(110 + Math.random() * 40);
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRadialContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRoundedSquareShape(size: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const half = size / 2;
  shape.moveTo(-half + radius, -half);
  shape.lineTo(half - radius, -half);
  shape.quadraticCurveTo(half, -half, half, -half + radius);
  shape.lineTo(half, half - radius);
  shape.quadraticCurveTo(half, half, half - radius, half);
  shape.lineTo(-half + radius, half);
  shape.quadraticCurveTo(-half, half, -half, half - radius);
  shape.lineTo(-half, -half + radius);
  shape.quadraticCurveTo(-half, -half, -half + radius, -half);
  return shape;
}

export const XiaomiScale3DViewer: React.FC<XiaomiScale3DViewerProps> = ({
  selectedModel,
  onSelectModel,
  currentWeightKg,
  currentBmi,
  impedanceOhm,
  onQuickWeighIn,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [explodedAmount, setExplodedAmount] = useState<number>(0);
  const [finishPreset, setFinishPreset] = useState<FinishPreset>('obsidian');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [biaWaveActive, setBiaWaveActive] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  // Mutable refs consumed by the WebGL loop without re-mounting the canvas
  const stateRef = useRef({
    explodedTarget: 0,
    explodedCurrent: 0,
    finishPreset: 'obsidian' as FinishPreset,
    selectedModel,
    biaWaveActive: true,
    cameraPreset: 'iso' as CameraPreset,
    cameraTransitioning: false,
    weightKg: currentWeightKg,
    bmi: currentBmi,
    impedanceOhm,
  });

  const requestRenderRef = useRef<() => void>(() => {});
  const updateLedTextureRef = useRef<() => void>(() => {});
  const updateFinishRef = useRef<() => void>(() => {});

  useEffect(() => {
    stateRef.current.explodedTarget = explodedAmount;
    requestRenderRef.current();
  }, [explodedAmount]);

  useEffect(() => {
    stateRef.current.finishPreset = finishPreset;
    updateFinishRef.current();
    requestRenderRef.current();
  }, [finishPreset]);

  useEffect(() => {
    stateRef.current.selectedModel = selectedModel;
    requestRenderRef.current();
  }, [selectedModel]);

  useEffect(() => {
    stateRef.current.biaWaveActive = biaWaveActive;
    requestRenderRef.current();
  }, [biaWaveActive]);

  useEffect(() => {
    stateRef.current.cameraPreset = cameraPreset;
    stateRef.current.cameraTransitioning = true;
    requestRenderRef.current();
  }, [cameraPreset]);

  useEffect(() => {
    stateRef.current.weightKg = currentWeightKg;
    stateRef.current.bmi = currentBmi;
    stateRef.current.impedanceOhm = impedanceOhm;
    updateLedTextureRef.current();
    requestRenderRef.current();
  }, [currentWeightKg, currentBmi, impedanceOhm]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 540);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040507);
    scene.fog = new THREE.FogExp2(0x040507, 0.065);

    // 2. Mandatory Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 800) / (container.clientHeight || 540),
      0.1,
      50
    );
    camera.position.set(3.2, 2.75, 3.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 1.8;
    controls.maxDistance = 8.5;
    controls.target.set(0, 0.25, 0);

    // 3. Balanced 3-Point Studio Rig + Warm/Cool Contrast
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x09090b, 0.55);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(3.5, 5.5, 3.0);
    keyLight.castShadow = !isSoftwareGl;
    const d = 2.6;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x10b981, 1.35);
    rimLight.position.set(-3.5, 2.4, -3.2);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xffffff, 3.5, 2.4, 1.4);
      softbox.position.set(0, 3.6, 1.8);
      softbox.lookAt(0, 0.2, 0);
      scene.add(softbox);
    }

    // 4. Ground Pedestal & Contact Shadow Grounding
    const floorGeo = new THREE.CircleGeometry(7, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x07080c,
      roughness: 0.85,
      metalness: 0.15,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.005;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const shadowTex = createRadialContactShadowTexture();
    const contactShadowGeo = new THREE.PlaneGeometry(3.2, 3.2);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.002;
    scene.add(contactShadow);

    // 5. Composite 10-Part Procedural Model (THREE.Group) pivoted at bottom-center (Y=0)
    const scaleRoot = new THREE.Group();
    scaleRoot.position.set(0, 0, 0);
    scene.add(scaleRoot);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const brushedBump = createBrushedMetalBumpTexture(maxAniso);

    // Layer 0: 4 Load-Cell Silicone Feet + Strain Gauge Rings (Parts 1..4)
    const feetGroup = new THREE.Group();
    scaleRoot.add(feetGroup);

    const footLathePoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.21, 0.03),
      new THREE.Vector2(0.17, 0.08),
      new THREE.Vector2(0, 0.08),
    ];
    const footGeo = new THREE.LatheGeometry(footLathePoints, 32);
    const footMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.78,
      metalness: 0.12,
    });
    const gaugeRingGeo = new THREE.TorusGeometry(0.19, 0.015, 16, 36);
    const gaugeRingMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x064e3b,
      emissiveIntensity: 0.5,
    });

    const footCoords: [number, number][] = [
      [-0.72, -0.72],
      [0.72, -0.72],
      [-0.72, 0.72],
      [0.72, 0.72],
    ];
    footCoords.forEach(([fx, fz]) => {
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(fx, 0, fz);
      foot.castShadow = true;
      feetGroup.add(foot);

      const ring = new THREE.Mesh(gaugeRingGeo, gaugeRingMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(fx, 0.04, fz);
      feetGroup.add(ring);
    });

    // Layer 1: Lower ABS Structural Unibody Housing (Part 5)
    const chassisGroup = new THREE.Group();
    scaleRoot.add(chassisGroup);

    const chassisShape = createRoundedSquareShape(2.12, 0.28);
    const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.035,
    });
    chassisGeo.rotateX(Math.PI / 2);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x121318,
      roughness: 0.55,
      metalness: 0.25,
    });
    const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    chassisMesh.position.y = 0.16;
    chassisMesh.castShadow = true;
    chassisMesh.receiveShadow = true;
    chassisGroup.add(chassisMesh);

    // Layer 2: Internal BIA Copper-Gold Sensor Coil & Bluetooth Telemetry Module (Part 6)
    const pcbGroup = new THREE.Group();
    scaleRoot.add(pcbGroup);

    const pcbBoardGeo = new THREE.BoxGeometry(1.45, 0.025, 1.45);
    const pcbBoardMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      roughness: 0.38,
      metalness: 0.45,
    });
    const pcbMesh = new THREE.Mesh(pcbBoardGeo, pcbBoardMat);
    pcbMesh.position.y = 0.21;
    pcbGroup.add(pcbMesh);

    const coilGeo = new THREE.TorusGeometry(0.42, 0.018, 12, 48);
    const coilMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.22,
      metalness: 0.92,
    });
    const coilMesh = new THREE.Mesh(coilGeo, coilMat);
    coilMesh.rotation.x = Math.PI / 2;
    coilMesh.position.y = 0.23;
    pcbGroup.add(coilMesh);

    // InstancedMesh for 36 gold PCB micro-capacitors & telemetry pins (>20 repeated items)
    const pinGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12);
    const pinMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.2,
      metalness: 0.95,
    });
    const pinInstances = new THREE.InstancedMesh(pinGeo, pinMat, 36);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const rad = i % 2 === 0 ? 0.52 : 0.62;
      dummy.position.set(Math.cos(angle) * rad, 0.235, Math.sin(angle) * rad);
      dummy.scale.setScalar(0.9 + (i % 3) * 0.1);
      dummy.updateMatrix();
      pinInstances.setMatrixAt(i, dummy.matrix);
    }
    pinInstances.instanceMatrix.needsUpdate = true;
    pinInstances.computeBoundingSphere();
    pcbGroup.add(pinInstances);

    // Layer 3: Tempered Architectural Glass Deck + Hidden-Until-Lit OLED Matrix (Parts 7 & 8)
    const glassGroup = new THREE.Group();
    scaleRoot.add(glassGroup);

    const glassShape = createRoundedSquareShape(2.2, 0.3);
    const glassGeo = new THREE.ExtrudeGeometry(glassShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    glassGeo.rotateX(Math.PI / 2);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x090d14,
      roughness: 0.08,
      metalness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.72,
      transparent: true,
      opacity: isSoftwareGl ? 0.82 : 1.0,
      ior: 1.52,
      thickness: 0.6,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.y = 0.265;
    glassMesh.castShadow = true;
    glassMesh.receiveShadow = true;
    glassGroup.add(glassMesh);

    // LED Display Plane
    let ledTexture = createLedDisplayTexture(
      stateRef.current.weightKg,
      stateRef.current.bmi,
      stateRef.current.impedanceOhm,
      maxAniso
    );
    const ledGeo = new THREE.PlaneGeometry(0.76, 0.38);
    const ledMat = new THREE.MeshBasicMaterial({
      map: ledTexture,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledMesh.rotation.x = -Math.PI / 2;
    ledMesh.position.set(0, 0.282, -0.58);
    glassGroup.add(ledMesh);

    // Layer 4: 4 Brushed 304L Stainless Steel BIA Electrodes + Center Mi Emblem (Parts 9..12)
    const electrodesGroup = new THREE.Group();
    scaleRoot.add(electrodesGroup);

    const electrodeGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.012, 48);
    electrodeGeo.computeTangents();
    const electrodeMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4d4d8,
      roughness: 0.18,
      metalness: 0.94,
      bumpMap: brushedBump,
      bumpScale: 0.004,
      anisotropy: 0.8,
      anisotropyRotation: Math.PI / 4,
      clearcoat: 0.4,
    });

    const electrodePositions: [number, number][] = [
      [-0.56, -0.45],
      [0.56, -0.45],
      [-0.56, 0.48],
      [0.56, 0.48],
    ];
    const electrodeMeshes: THREE.Mesh[] = [];
    electrodePositions.forEach(([ex, ez]) => {
      const el = new THREE.Mesh(electrodeGeo, electrodeMat);
      el.position.set(ex, 0.285, ez);
      el.receiveShadow = true;
      electrodesGroup.add(el);
      electrodeMeshes.push(el);
    });

    // Center Metallic Ring Emblem
    const emblemGeo = new THREE.RingGeometry(0.11, 0.145, 48);
    const emblemMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.2,
      metalness: 0.9,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const emblemMesh = new THREE.Mesh(emblemGeo, emblemMat);
    emblemMesh.rotation.x = -Math.PI / 2;
    emblemMesh.position.set(0, 0.286, 0.02);
    electrodesGroup.add(emblemMesh);

    // Layer 5: Retractable 8-Electrode Handlebar Assembly (Visible on Xiaomi Eight-Electrode model)
    const handleGroup = new THREE.Group();
    scaleRoot.add(handleGroup);

    const barCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.68, 0.3, -0.95),
      new THREE.Vector3(-0.62, 0.62, -1.02),
      new THREE.Vector3(0, 0.65, -1.04),
      new THREE.Vector3(0.62, 0.62, -1.02),
      new THREE.Vector3(0.68, 0.3, -0.95),
    ]);
    const handleTubeGeo = new THREE.TubeGeometry(barCurve, 40, 0.045, 16, false);
    const handleBarMesh = new THREE.Mesh(handleTubeGeo, electrodeMat);
    handleBarMesh.castShadow = true;
    handleGroup.add(handleBarMesh);

    // BIA Bio-Impedance Ring Pulse Wave
    const waveRingGeo = new THREE.RingGeometry(0.16, 0.21, 64);
    const waveRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const waveRingMesh = new THREE.Mesh(waveRingGeo, waveRingMat);
    waveRingMesh.rotation.x = -Math.PI / 2;
    waveRingMesh.position.set(0, 0.288, 0.02);
    electrodesGroup.add(waveRingMesh);

    // Callbacks for updating textures and finishes without recreating WebGL context
    updateLedTextureRef.current = () => {
      const nextTex = createLedDisplayTexture(
        stateRef.current.weightKg,
        stateRef.current.bmi,
        stateRef.current.impedanceOhm,
        maxAniso
      );
      ledMat.map.dispose();
      ledMat.map = nextTex;
      ledMat.needsUpdate = true;
      ledTexture = nextTex;
    };

    updateFinishRef.current = () => {
      const f = stateRef.current.finishPreset;
      if (f === 'obsidian') {
        glassMat.color.setHex(0x090d14);
        chassisMat.color.setHex(0x121318);
        electrodeMat.color.setHex(0xd4d4d8);
      } else if (f === 'ceramic') {
        glassMat.color.setHex(0xf4f4f6);
        chassisMat.color.setHex(0xe4e4e7);
        electrodeMat.color.setHex(0xa1a1aa);
      } else {
        glassMat.color.setHex(0x1e293b);
        chassisMat.color.setHex(0x0f172a);
        electrodeMat.color.setHex(0xe2e8f0);
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Paced Render Loop with Software WebGL Fence Sync Support
    let frameId = 0;
    let isDisposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Smooth exponential damping for Exploded View layers
      stateRef.current.explodedCurrent = THREE.MathUtils.damp(
        stateRef.current.explodedCurrent,
        stateRef.current.explodedTarget,
        6,
        dt
      );
      const exp = stateRef.current.explodedCurrent;
      chassisGroup.position.y = exp * 0.25;
      pcbGroup.position.y = exp * 0.55;
      glassGroup.position.y = exp * 0.9;
      electrodesGroup.position.y = exp * 1.25;
      handleGroup.position.y = exp * 1.4;

      // Toggle visibility of electrodes / 8-electrode bar depending on Xiaomi generation
      const model = stateRef.current.selectedModel;
      const hasElectrodes = model === 'mi-body-comp-2' || model === 'mi-eight-electrode';
      electrodeMeshes.forEach((m) => {
        m.visible = hasElectrodes;
      });
      handleGroup.visible = model === 'mi-eight-electrode';

      // BIA Wave Ring subtle expansion
      if (stateRef.current.biaWaveActive && hasElectrodes) {
        waveRingMesh.visible = true;
        const waveCycle = (elapsed * 0.85) % 1;
        const s = 1 + waveCycle * 4.5;
        waveRingMesh.scale.set(s, s, 1);
        waveRingMat.opacity = (1 - waveCycle) * 0.5;
      } else {
        waveRingMesh.visible = false;
      }

      // Smooth Camera Preset Transitions
      if (stateRef.current.cameraTransitioning) {
        const preset = stateRef.current.cameraPreset;
        if (preset === 'iso') {
          _targetCamPos.set(3.1, 2.65, 3.4);
          _targetLookAt.set(0, 0.25 + exp * 0.4, 0);
        } else if (preset === 'top') {
          _targetCamPos.set(0, 4.4, 0.01);
          _targetLookAt.set(0, 0.2, 0);
        } else if (preset === 'side') {
          _targetCamPos.set(4.2, 0.85, 0);
          _targetLookAt.set(0, 0.35 + exp * 0.5, 0);
        } else {
          // display close-up
          _targetCamPos.set(0, 1.65, -1.45);
          _targetLookAt.set(0, 0.28 + exp * 0.9, -0.55);
        }

        const k = 1 - Math.exp(-6 * dt);
        camera.position.lerp(_targetCamPos, k);
        controls.target.lerp(_targetLookAt, k);

        if (camera.position.distanceTo(_targetCamPos) < 0.03) {
          stateRef.current.cameraTransitioning = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    const onControlsStart = () => {
      stateRef.current.cameraTransitioning = false;
    };
    controls.addEventListener('start', onControlsStart);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      ledTexture.dispose();
      brushedBump.dispose();
      shadowTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative h-[560px] w-full overflow-hidden rounded-3xl border border-zinc-800/90 bg-[#040507] sm:h-[640px]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="h-full w-full" />

      {/* Top-Left Minimal Spec Header Overlay (No backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute top-4 left-4 z-10 flex flex-col gap-1 rounded-2xl border border-zinc-800/90 bg-zinc-950/90 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-100">
            {selectedModel === 'mi-scale-1'
              ? 'Xiaomi Mi Scale 1 (XMTZC01HM)'
              : selectedModel === 'mi-scale-2'
                ? 'Xiaomi Mi Scale 2 (XMTZC04HM)'
                : selectedModel === 'mi-body-comp-2'
                  ? 'Xiaomi Mi Body Composition Scale 2'
                  : 'Xiaomi Eight-Electrode Scale Pro'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-emerald-400">{currentWeightKg.toFixed(1)} kg</span>
        </div>
        <p className="text-[11px] text-zinc-400">
          Inspection 3D PBR · Glisser pour tourner · Molette pour zoomer
        </p>
      </div>

      {/* Unified Collapsible Bottom Control Dock (Zero Side-Panel Clutter, No backdrop-filter) */}
      <div
        className="  absolute bottom-4 left-1/2 z-10 w-[94%] max-w-[880px] -translate-x-1/2 transition-transform duration-200"
        style={{
          transform: dockCollapsed
            ? 'translate(-50%, calc(100% - 36px))'
            : 'translate(-50%, 0)',
        }}
      >
        {/* Collapse / Expand Toggle Handle */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            className="flex items-center gap-1.5 rounded-t-xl border border-b-0 border-zinc-800 bg-zinc-950 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
                <span>Afficher le dock 3D</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                <span>Masquer les contrôles (Mode Zen)</span>
              </>
            )}
          </button>
        </div>

        {/* Main Horizontal Control Bar */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Generation Switcher */}
            <div className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1">
              {(
                [
                  { id: 'mi-scale-1', label: 'Gen 1' },
                  { id: 'mi-scale-2', label: 'Gen 2' },
                  { id: 'mi-body-comp-2', label: 'Body Comp 2' },
                  { id: 'mi-eight-electrode', label: '8-Électrodes' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectModel(m.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedModel === m.id
                      ? 'bg-emerald-500 text-black font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Exploded View Slider */}
            <div className="flex items-center gap-2.5">
              <Layers className="h-4 w-4 text-zinc-400" />
              <label htmlFor="exploded-slider" className="text-xs font-medium text-zinc-300 whitespace-nowrap">
                Vue éclatée
              </label>
              <input
                id="exploded-slider"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={explodedAmount}
                onChange={(e) => setExplodedAmount(parseFloat(e.target.value))}
                className="h-1.5 w-24 cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Finish Swatches */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'obsidian', label: 'Noir AMOLED', color: 'bg-zinc-950 border-zinc-600' },
                  { id: 'ceramic', label: 'Blanc Céramique', color: 'bg-zinc-100 border-zinc-400' },
                  { id: 'titanium', label: 'Titane', color: 'bg-slate-700 border-slate-400' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFinishPreset(f.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    finishPreset === f.id
                      ? 'border-emerald-500 bg-zinc-900 text-white'
                      : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full border ${f.color}`} />
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {/* Camera Views & BIA Wave Toggle */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'iso', label: '3/4 Studio' },
                  { id: 'top', label: 'Dessus' },
                  { id: 'display', label: 'Écran LED' },
                  { id: 'side', label: 'Profil' },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => setCameraPreset(cam.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    cameraPreset === cam.id
                      ? 'bg-zinc-800 text-emerald-400'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  {cam.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setBiaWaveActive((v) => !v)}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  biaWaveActive
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Onde BIA</span>
              </button>

              <button
                type="button"
                onClick={onQuickWeighIn}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 whitespace-nowrap transition-colors"
              >
                Simuler Pesée BLE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
