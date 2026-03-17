import * as THREE from "three";
import "./style.css";

const TRACK_WIDTH = 16;
const WALL_LIMIT = TRACK_WIDTH * 0.62;
const CHECKPOINT_COUNT = 6;
const LAPS_TO_WIN = 3;
const AI_COUNT = 4;
const KART_RADIUS = 2.35;
const ITEM_BOX_RESPAWN = 7;
const PLAYER_CONFIG = {
  maxSpeed: 72,
  offRoadMaxSpeed: 36,
  acceleration: 42,
  brakeForce: 64,
  reverseAcceleration: 26,
  maxReverse: -18,
  friction: 14,
  wallDrag: 0.82,
  trackAssist: 2.4,
  turnRate: 2.6,
  driftTurnRate: 3.35,
  driftThreshold: 0.34,
  boostForce: 28,
};
const RESET_Y = 1.1;
const trackHalfWidth = TRACK_WIDTH / 2;

const TRACKS = [
  {
    id: "skyline",
    name: "Skyline Sprint",
    theme: {
      sky: 0x78cbda,
      fog: 0x6cc2cc,
      ground: 0x3ea75a,
      infield: 0x6abf4a,
      road: 0x2c3d4d,
      border: 0xd46b32,
      stripe: 0xfff3d9,
      banner: 0x1c6f78,
      treeLeaf: 0x1d8c4d,
      treeTrunk: 0x7e4527,
      rock: 0x74828f,
    },
    points: [
      [0, 0, 68],
      [42, 0, 58],
      [70, 0, 18],
      [62, 0, -42],
      [18, 0, -74],
      [-36, 0, -62],
      [-70, 0, -16],
      [-58, 0, 46],
    ],
    boostPads: [
      { t: 0.11, offset: -2.4 },
      { t: 0.39, offset: 1.8 },
      { t: 0.67, offset: -1.6 },
    ],
    itemBoxes: [
      { t: 0.18, offset: -3.4 },
      { t: 0.18, offset: 0 },
      { t: 0.18, offset: 3.4 },
      { t: 0.58, offset: -3.2 },
      { t: 0.58, offset: 0.2 },
      { t: 0.58, offset: 3.6 },
    ],
  },
  {
    id: "harbor",
    name: "Harbor Heat",
    theme: {
      sky: 0x7db7f4,
      fog: 0x8acfd9,
      ground: 0x3f9561,
      infield: 0x67b88d,
      road: 0x283648,
      border: 0xef7d44,
      stripe: 0xfff1d2,
      banner: 0x0d5764,
      treeLeaf: 0x187950,
      treeTrunk: 0x734122,
      rock: 0x6f859c,
    },
    points: [
      [0, 0, 74],
      [52, 0, 64],
      [80, 0, 28],
      [78, 0, -20],
      [54, 0, -58],
      [12, 0, -82],
      [-38, 0, -74],
      [-78, 0, -34],
      [-74, 0, 18],
      [-38, 0, 66],
    ],
    boostPads: [
      { t: 0.08, offset: 2.2 },
      { t: 0.45, offset: -2.6 },
      { t: 0.79, offset: 1.4 },
    ],
    itemBoxes: [
      { t: 0.24, offset: -4.2 },
      { t: 0.24, offset: 0 },
      { t: 0.24, offset: 4.2 },
      { t: 0.72, offset: -4.1 },
      { t: 0.72, offset: 0.3 },
      { t: 0.72, offset: 4.1 },
    ],
  },
];

const ITEM_LABELS = {
  turbo: "Turbo",
  shield: "Shield",
  pulse: "Pulse",
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const worldRoot = new THREE.Group();
scene.add(worldRoot);

const hud = {
  lap: document.querySelector("#lap-value"),
  place: document.querySelector("#place-value"),
  speed: document.querySelector("#speed-value"),
  timer: document.querySelector("#timer-value"),
  track: document.querySelector("#track-value"),
  item: document.querySelector("#item-value"),
  countdown: document.querySelector("#countdown"),
  message: document.querySelector("#message-panel"),
  menuButton: document.querySelector("#menu-button"),
  menu: document.querySelector("#menu-overlay"),
  finish: document.querySelector("#finish-overlay"),
  finishTitle: document.querySelector("#finish-title"),
  finishSummary: document.querySelector("#finish-summary"),
  startButton: document.querySelector("#start-button"),
  restartButton: document.querySelector("#restart-button"),
  backToMenuButton: document.querySelector("#back-to-menu-button"),
  trackButtons: Array.from(document.querySelectorAll("[data-track-index]")),
};

const input = {
  accelerate: false,
  brake: false,
  left: false,
  right: false,
  drift: false,
};

const clock = new THREE.Clock();
const cameraLookTarget = new THREE.Vector3();
const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const tmpVecC = new THREE.Vector3();
const tmpVecD = new THREE.Vector3();

let track = null;

const player = createPlayerKart();
const aiRacers = Array.from({ length: AI_COUNT }, (_, index) => createAiKart(index));

const raceState = {
  phase: "menu",
  countdown: 3,
  timer: 0,
  finishers: [],
  messageTimer: 0,
  messageText: "",
  selectedTrackIndex: 0,
};

setupScene();
buildWorldForTrack(raceState.selectedTrackIndex);
resetRace();
attachEvents();
animate();

function setupScene() {
  const hemi = new THREE.HemisphereLight(0xffefc7, 0x1e5961, 1.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0bd, 2.2);
  sun.position.set(28, 48, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -130;
  sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130;
  sun.shadow.camera.bottom = -130;
  scene.add(sun);

  camera.position.set(0, 18, -20);
  camera.lookAt(0, 0, 20);
}

function buildWorldForTrack(index) {
  raceState.selectedTrackIndex = index;
  const definition = TRACKS[index];

  worldRoot.clear();
  renderer.setClearColor(definition.theme.sky);
  scene.fog = new THREE.Fog(definition.theme.fog, 110, 250);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(185, 96),
    new THREE.MeshStandardMaterial({ color: definition.theme.ground, roughness: 0.96 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  worldRoot.add(ground);

  const innerGround = new THREE.Mesh(
    new THREE.CircleGeometry(92, 56),
    new THREE.MeshStandardMaterial({ color: definition.theme.infield, roughness: 1 }),
  );
  innerGround.rotation.x = -Math.PI / 2;
  innerGround.position.y = 0.02;
  innerGround.receiveShadow = true;
  worldRoot.add(innerGround);

  track = createTrack(definition);
  worldRoot.add(track.group);
  createScenery(track, definition, track.group);
  createStartGate(track, definition, track.group);

  hud.track.textContent = definition.name;
  updateTrackButtons();
}

function createTrack(definition) {
  const points = definition.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.22);
  const sampleCount = 560;
  const samples = [];
  const lengths = curve.getLengths(sampleCount);
  const trackLength = lengths[lengths.length - 1];
  const group = new THREE.Group();

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleCount;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    samples.push({
      t,
      point,
      tangent,
      normal,
      distance: lengths[index],
    });
  }

  const roadGeometry = new THREE.BufferGeometry();
  const borderGeometry = new THREE.BufferGeometry();
  const stripeGeometry = new THREE.BufferGeometry();
  const roadPositions = [];
  const roadNormals = [];
  const roadUvs = [];
  const borderPositions = [];
  const borderNormals = [];
  const stripePositions = [];
  const stripeNormals = [];

  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index];
    const next = samples[(index + 1) % samples.length];

    const leftCurrent = current.point.clone().addScaledVector(current.normal, trackHalfWidth);
    const rightCurrent = current.point.clone().addScaledVector(current.normal, -trackHalfWidth);
    const leftNext = next.point.clone().addScaledVector(next.normal, trackHalfWidth);
    const rightNext = next.point.clone().addScaledVector(next.normal, -trackHalfWidth);

    pushQuad(roadPositions, leftCurrent, rightCurrent, rightNext, leftNext);
    pushNormals(roadNormals, 6);
    roadUvs.push(
      0, current.distance / 22,
      1, current.distance / 22,
      1, next.distance / 22,
      0, current.distance / 22,
      1, next.distance / 22,
      0, next.distance / 22,
    );

    const outerBorder = 3.3;
    const leftBorderCurrent = leftCurrent.clone().addScaledVector(current.normal, outerBorder);
    const leftBorderNext = leftNext.clone().addScaledVector(next.normal, outerBorder);
    const rightBorderCurrent = rightCurrent.clone().addScaledVector(current.normal, -outerBorder);
    const rightBorderNext = rightNext.clone().addScaledVector(next.normal, -outerBorder);

    pushQuad(borderPositions, leftBorderCurrent, leftCurrent, leftNext, leftBorderNext);
    pushNormals(borderNormals, 6);
    pushQuad(borderPositions, rightCurrent, rightBorderCurrent, rightBorderNext, rightNext);
    pushNormals(borderNormals, 6);

    const stripeWidth = 0.85;
    const stripeOffset = trackHalfWidth * 0.86;
    const leftStripeCurrent = current.point.clone().addScaledVector(current.normal, stripeOffset + stripeWidth);
    const leftStripeInnerCurrent = current.point.clone().addScaledVector(current.normal, stripeOffset);
    const leftStripeNext = next.point.clone().addScaledVector(next.normal, stripeOffset + stripeWidth);
    const leftStripeInnerNext = next.point.clone().addScaledVector(next.normal, stripeOffset);
    const rightStripeCurrent = current.point.clone().addScaledVector(current.normal, -(stripeOffset + stripeWidth));
    const rightStripeInnerCurrent = current.point.clone().addScaledVector(current.normal, -stripeOffset);
    const rightStripeNext = next.point.clone().addScaledVector(next.normal, -(stripeOffset + stripeWidth));
    const rightStripeInnerNext = next.point.clone().addScaledVector(next.normal, -stripeOffset);

    if (index % 5 < 3) {
      pushQuad(stripePositions, leftStripeCurrent, leftStripeInnerCurrent, leftStripeInnerNext, leftStripeNext);
      pushNormals(stripeNormals, 6);
      pushQuad(stripePositions, rightStripeInnerCurrent, rightStripeCurrent, rightStripeNext, rightStripeInnerNext);
      pushNormals(stripeNormals, 6);
    }
  }

  roadGeometry.setAttribute("position", new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(roadNormals, 3));
  roadGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(roadUvs, 2));
  const road = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({
      color: definition.theme.road,
      roughness: 0.95,
      metalness: 0.04,
    }),
  );
  road.receiveShadow = true;
  group.add(road);

  borderGeometry.setAttribute("position", new THREE.Float32BufferAttribute(borderPositions, 3));
  borderGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(borderNormals, 3));
  const borders = new THREE.Mesh(
    borderGeometry,
    new THREE.MeshStandardMaterial({
      color: definition.theme.border,
      roughness: 0.92,
    }),
  );
  borders.position.y = 0.04;
  borders.receiveShadow = true;
  group.add(borders);

  stripeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(stripePositions, 3));
  stripeGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(stripeNormals, 3));
  const stripes = new THREE.Mesh(
    stripeGeometry,
    new THREE.MeshStandardMaterial({
      color: definition.theme.stripe,
      roughness: 0.72,
      emissive: definition.theme.stripe,
      emissiveIntensity: 0.04,
    }),
  );
  stripes.position.y = 0.08;
  stripes.receiveShadow = true;
  group.add(stripes);

  const boostPads = definition.boostPads.map((pad) => {
    const sample = sampleTrack(curve, pad.t);
    const padMesh = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.18, 2.8),
      new THREE.MeshStandardMaterial({
        color: 0xffbf47,
        emissive: 0xff8f3f,
        emissiveIntensity: 0.65,
        roughness: 0.45,
      }),
    );
    padMesh.position.copy(sample.point).addScaledVector(sample.normal, pad.offset);
    padMesh.position.y = 0.2;
    padMesh.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    padMesh.castShadow = true;
    padMesh.receiveShadow = true;
    group.add(padMesh);
    return { ...pad, mesh: padMesh };
  });

  const itemBoxes = definition.itemBoxes.map((box, index) => {
    const sample = sampleTrack(curve, box.t);
    const holder = new THREE.Group();
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 1.95, 1.95),
      new THREE.MeshStandardMaterial({
        color: 0x79d8ff,
        emissive: 0x44b4ff,
        emissiveIntensity: 0.42,
        transparent: true,
        opacity: 0.82,
        roughness: 0.28,
      }),
    );
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.14, 12, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffe275,
        emissive: 0xffc24d,
        emissiveIntensity: 0.3,
        roughness: 0.4,
      }),
    );
    frame.rotation.x = Math.PI / 2;
    cube.castShadow = true;
    frame.castShadow = true;
    holder.add(cube, frame);
    holder.position.copy(sample.point).addScaledVector(sample.normal, box.offset);
    holder.position.y = 2.1;
    group.add(holder);

    return {
      ...box,
      mesh: holder,
      active: true,
      respawnTimer: 0,
      bobPhase: index * 0.7,
    };
  });

  return {
    id: definition.id,
    name: definition.name,
    curve,
    samples,
    group,
    length: trackLength,
    boostPads,
    itemBoxes,
  };
}

function createScenery(trackData, definition, parent) {
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: definition.theme.treeTrunk, roughness: 1 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: definition.theme.treeLeaf, roughness: 0.92 });
  const rockMaterial = new THREE.MeshStandardMaterial({ color: definition.theme.rock, roughness: 1 });

  for (let index = 0; index < 54; index += 1) {
    const t = index / 54;
    const sample = sampleTrack(trackData.curve, t);
    const distance = 19 + (index % 8) * 3;
    const side = index % 2 === 0 ? 1 : -1;
    const position = sample.point.clone().addScaledVector(sample.normal, side * (trackHalfWidth + distance));

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.85, 4.4, 7), trunkMaterial);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.7, 5.9, 8), leafMaterial);
    crown.position.y = 4.6;
    crown.castShadow = true;
    crown.receiveShadow = true;

    tree.add(trunk, crown);
    tree.position.copy(position);
    tree.position.y = 2.2;
    tree.rotation.y = t * Math.PI * 4.4;
    parent.add(tree);
  }

  for (let index = 0; index < 30; index += 1) {
    const t = (index * 0.31) % 1;
    const sample = sampleTrack(trackData.curve, t);
    const side = index % 2 === 0 ? 1 : -1;
    const distance = 28 + (index % 6) * 4.4;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.3 + (index % 3) * 0.75, 0),
      rockMaterial,
    );
    rock.position.copy(sample.point).addScaledVector(sample.normal, side * (trackHalfWidth + distance));
    rock.position.y = 2.2;
    rock.rotation.set(t * Math.PI * 4, t * 7, t * 5);
    rock.castShadow = true;
    rock.receiveShadow = true;
    parent.add(rock);
  }
}

function createStartGate(trackData, definition, parent) {
  const gate = new THREE.Group();
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0xfff0cf, roughness: 0.82 });
  const bannerMaterial = new THREE.MeshStandardMaterial({
    color: definition.theme.banner,
    roughness: 0.4,
    emissive: 0x4fe0d5,
    emissiveIntensity: 0.25,
  });
  const startSample = sampleTrack(trackData.curve, 0.992);

  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2), postMaterial);
  const rightPost = leftPost.clone();
  const banner = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH + 5, 1.5, 1.2), bannerMaterial);

  leftPost.position.copy(startSample.point).addScaledVector(startSample.normal, trackHalfWidth + 2.5);
  rightPost.position.copy(startSample.point).addScaledVector(startSample.normal, -(trackHalfWidth + 2.5));
  leftPost.position.y = 4.4;
  rightPost.position.y = 4.4;
  banner.position.copy(startSample.point);
  banner.position.y = 8.6;
  banner.rotation.y = Math.atan2(startSample.tangent.x, startSample.tangent.z);
  leftPost.rotation.y = banner.rotation.y;
  rightPost.rotation.y = banner.rotation.y;

  leftPost.castShadow = true;
  rightPost.castShadow = true;
  banner.castShadow = true;
  leftPost.receiveShadow = true;
  rightPost.receiveShadow = true;

  gate.add(leftPost, rightPost, banner);

  for (let stripe = -5; stripe <= 5; stripe += 1) {
    const plane = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.08, TRACK_WIDTH + 1),
      new THREE.MeshStandardMaterial({
        color: stripe % 2 === 0 ? 0x0b1b1f : 0xf4ece4,
        roughness: 0.7,
      }),
    );
    plane.position.copy(startSample.point).addScaledVector(startSample.tangent, stripe * 1.1);
    plane.position.y = 0.12;
    plane.rotation.y = Math.atan2(startSample.tangent.x, startSample.tangent.z) + Math.PI / 2;
    plane.receiveShadow = true;
    gate.add(plane);
  }

  parent.add(gate);
}

function createPlayerKart() {
  const mesh = buildKartMesh(0xf14b4b, 0xffd166, 0x303b52);
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(2.55, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0x64dfff,
      emissive: 0x64dfff,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.24,
      roughness: 0.1,
    }),
  );
  shield.visible = false;
  shield.position.y = 1.35;
  mesh.add(shield);
  scene.add(mesh);

  return {
    id: "player",
    mesh,
    shield,
    position: new THREE.Vector3(),
    heading: 0,
    steerVisual: 0,
    speed: 0,
    driftCharge: 0,
    boostTimer: 0,
    shieldTimer: 0,
    item: null,
    lap: 0,
    t: 0,
    lateral: 0,
    sectors: new Set(),
    finishedAt: null,
    finishPosition: null,
  };
}

function createAiKart(index) {
  const palette = [
    [0x4f80ff, 0x9bc6ff, 0x1b2644],
    [0x8f52ff, 0xcaa3ff, 0x2d1e52],
    [0xf77f54, 0xffd8b4, 0x4b2c22],
    [0x34c795, 0xbaf7d8, 0x193e34],
  ][index % 4];

  const mesh = buildKartMesh(palette[0], palette[1], palette[2]);
  scene.add(mesh);

  return {
    id: `ai-${index}`,
    mesh,
    progress: 0,
    speed: 0,
    baseSpeed: 53 + index * 2.7,
    maxSpeed: 62 + index * 2.4,
    launchBoost: 8 + index * 1.2,
    pacePhase: Math.random() * Math.PI * 2,
    lanePhase: Math.random() * Math.PI * 2,
    offsetBase: (index % 2 === 0 ? -1 : 1) * (2.6 + Math.floor(index / 2) * 2.7),
    offset: 0,
    targetOffset: 0,
    lap: 0,
    finishedAt: null,
    wobble: Math.random() * Math.PI * 2,
  };
}

function buildKartMesh(primary, secondary, dark) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.58 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: secondary, roughness: 0.42, metalness: 0.1 });
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.95 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 4.4), bodyMaterial);
  base.position.y = 1.2;
  base.castShadow = true;
  base.receiveShadow = true;

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.6), accentMaterial);
  cockpit.position.set(0, 1.95, -0.2);
  cockpit.castShadow = true;
  cockpit.receiveShadow = true;

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.2), accentMaterial);
  nose.position.set(0, 1.1, 2.45);
  nose.castShadow = true;

  group.add(base, cockpit, nose);

  const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.55, 16);
  for (const [x, z] of [
    [-1.4, 1.55],
    [1.4, 1.55],
    [-1.4, -1.55],
    [1.4, -1.55],
  ]) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.75, z);
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    group.add(wheel);
  }

  return group;
}

function attachEvents() {
  const keyMap = {
    KeyW: "accelerate",
    ArrowUp: "accelerate",
    KeyS: "brake",
    ArrowDown: "brake",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
    ShiftLeft: "drift",
    ShiftRight: "drift",
  };

  window.addEventListener("keydown", (event) => {
    if (keyMap[event.code]) {
      input[keyMap[event.code]] = true;
      event.preventDefault();
      return;
    }

    if (event.code === "Space") {
      if (raceState.phase === "racing") {
        if (!event.repeat) {
          usePlayerItem();
        }
      } else if (raceState.phase === "menu" || raceState.phase === "finished") {
        startRace();
      }
      event.preventDefault();
      return;
    }

    if (event.code === "Enter") {
      if (raceState.phase === "menu" || raceState.phase === "finished") {
        startRace();
      }
      return;
    }

    if (event.code === "Escape") {
      openTrackSelect();
      return;
    }

    if (event.code === "KeyR") {
      resetPlayerToTrack();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (keyMap[event.code]) {
      input[keyMap[event.code]] = false;
      event.preventDefault();
    }
  });

  window.addEventListener("blur", clearInputState);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInputState();
    }
  });

  window.addEventListener("resize", onResize);
  hud.startButton.addEventListener("click", startRace);
  hud.restartButton.addEventListener("click", startRace);
  hud.menuButton.addEventListener("click", openTrackSelect);
  hud.backToMenuButton.addEventListener("click", openTrackSelect);

  hud.trackButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.trackIndex);
      buildWorldForTrack(index);
      resetRace();
    });
  });
}

function startRace() {
  resetRace();
  raceState.phase = "countdown";
  hud.menu.classList.add("hidden");
  hud.finish.classList.add("hidden");
  hud.menuButton.classList.remove("hidden");
}

function resetRace() {
  raceState.phase = "menu";
  raceState.countdown = 3;
  raceState.timer = 0;
  raceState.finishers = [];
  setMessage(`${track.name} loaded. Hit item boxes, then press Space to fire your pickup.`);
  resetPlayerState();
  resetAiState();
  updatePlacements();
  syncHud();
  hud.menu.classList.remove("hidden");
  hud.finish.classList.add("hidden");
  hud.countdown.classList.add("hidden");
  hud.menuButton.classList.add("hidden");
  track.itemBoxes.forEach((box) => {
    box.active = true;
    box.respawnTimer = 0;
    box.mesh.visible = true;
  });
}

function openTrackSelect() {
  clearInputState();
  resetRace();
}

function resetPlayerState() {
  const spawn = sampleTrack(track.curve, 0.02);
  player.position.copy(spawn.point).addScaledVector(spawn.normal, -2.4);
  player.position.y = RESET_Y;
  player.heading = Math.atan2(spawn.tangent.x, spawn.tangent.z);
  player.mesh.position.copy(player.position);
  player.mesh.rotation.set(0, player.heading, 0);
  player.speed = 0;
  player.driftCharge = 0;
  player.boostTimer = 0;
  player.shieldTimer = 0;
  player.item = null;
  player.lap = 0;
  player.t = 0.02;
  player.lateral = -2.4;
  player.sectors = new Set();
  player.finishedAt = null;
  player.finishPosition = null;
}

function resetAiState() {
  aiRacers.forEach((ai, index) => {
    ai.progress = 0.006 + (AI_COUNT - index - 1) * 0.014;
    ai.speed = 0;
    ai.offset = ai.offsetBase;
    ai.targetOffset = ai.offsetBase;
    ai.lap = 0;
    ai.finishedAt = null;
    placeAiMesh(ai);
  });
}

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = Math.min(clock.getDelta(), 0.033);

  updateRaceState(deltaTime);
  updateTrackObjects(deltaTime);
  updateCamera(deltaTime);
  syncHud();
  renderer.render(scene, camera);
}

function updateRaceState(deltaTime) {
  if (raceState.phase === "menu") {
    animateMenuCamera();
    return;
  }

  if (raceState.phase === "countdown") {
    raceState.countdown -= deltaTime;
    const display = Math.ceil(raceState.countdown);
    hud.countdown.textContent = display > 0 ? `${display}` : "GO!";
    hud.countdown.classList.remove("hidden");

    if (raceState.countdown <= -0.7) {
      raceState.phase = "racing";
      hud.countdown.classList.add("hidden");
      setMessage("Race live. Grab an item box and press Space to use the pickup.");
    }

    updatePlacements();
    return;
  }

  const isActiveRace = raceState.phase === "racing";
  if (isActiveRace) {
    raceState.timer += deltaTime;
  }

  updatePlayer(deltaTime, isActiveRace);
  aiRacers.forEach((ai) => updateAi(ai, deltaTime, isActiveRace));
  resolveKartCollisions();
  updateItemBoxes(deltaTime, isActiveRace);
  updatePlacements();

  if (raceState.messageTimer > 0) {
    raceState.messageTimer -= deltaTime;
    if (raceState.messageTimer <= 0) {
      setMessage("");
    }
  }
}

function updatePlayer(deltaTime, allowInput) {
  const nearestBefore = getNearestTrackSample(player.position);
  const onRoadBefore = Math.abs(nearestBefore.lateral) <= trackHalfWidth * 0.96;
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const throttleInput = input.accelerate ? 1 : 0;
  const brakeInput = input.brake ? 1 : 0;
  const speedRatio = THREE.MathUtils.clamp(Math.abs(player.speed) / PLAYER_CONFIG.maxSpeed, 0, 1);

  if (player.boostTimer > 0) {
    player.boostTimer = Math.max(0, player.boostTimer - deltaTime);
  }

  if (player.shieldTimer > 0) {
    player.shieldTimer = Math.max(0, player.shieldTimer - deltaTime);
  }

  if (allowInput) {
    const maxForward = onRoadBefore ? PLAYER_CONFIG.maxSpeed : PLAYER_CONFIG.offRoadMaxSpeed;
    const boostExtra = player.boostTimer > 0 ? PLAYER_CONFIG.boostForce : 0;

    if (throttleInput) {
      player.speed += PLAYER_CONFIG.acceleration * deltaTime;
    }

    if (brakeInput) {
      if (player.speed > 5) {
        player.speed -= PLAYER_CONFIG.brakeForce * deltaTime;
      } else {
        player.speed -= PLAYER_CONFIG.reverseAcceleration * deltaTime;
      }
    }

    if (!throttleInput && !brakeInput && player.speed > 0) {
      player.speed = moveToward(player.speed, 0, PLAYER_CONFIG.friction * deltaTime);
    }

    if (!throttleInput && !brakeInput && player.speed < 0) {
      player.speed = moveToward(player.speed, 0, PLAYER_CONFIG.friction * deltaTime * 0.9);
    }

    player.speed = THREE.MathUtils.clamp(player.speed, PLAYER_CONFIG.maxReverse, maxForward + boostExtra);

    if (input.drift && steerInput !== 0 && player.speed > 18 && onRoadBefore) {
      player.driftCharge += deltaTime;
    } else if (!input.drift && player.driftCharge >= PLAYER_CONFIG.driftThreshold) {
      player.boostTimer = Math.min(1.6, 0.65 + player.driftCharge * 0.45);
      setMessage("Mini-boost!");
      player.driftCharge = 0;
    } else if (!input.drift) {
      player.driftCharge = 0;
    }

    if (steerInput !== 0 && Math.abs(player.speed) > 1.5) {
      const turnRate = input.drift ? PLAYER_CONFIG.driftTurnRate : PLAYER_CONFIG.turnRate;
      const reverseFactor = player.speed >= 0 ? 1 : -0.8;
      player.heading += steerInput * turnRate * deltaTime * (0.46 + speedRatio * 0.96) * reverseFactor;
    } else {
      const targetHeading = Math.atan2(nearestBefore.tangent.x, nearestBefore.tangent.z);
      player.heading = dampAngle(player.heading, targetHeading, onRoadBefore ? 0.9 * deltaTime : 0.2 * deltaTime);
    }

    if (!onRoadBefore && player.speed > PLAYER_CONFIG.offRoadMaxSpeed) {
      player.speed = moveToward(player.speed, PLAYER_CONFIG.offRoadMaxSpeed, 36 * deltaTime);
    }

    if (onRoadBefore) {
      player.position.addScaledVector(nearestBefore.normal, -nearestBefore.lateral * PLAYER_CONFIG.trackAssist * deltaTime);
    }
  } else {
    player.speed = moveToward(player.speed, 0, 18 * deltaTime);
    player.heading = dampAngle(player.heading, Math.atan2(nearestBefore.tangent.x, nearestBefore.tangent.z), 0.6 * deltaTime);
  }

  tmpVecA.set(Math.sin(player.heading), 0, Math.cos(player.heading));
  player.position.addScaledVector(tmpVecA, player.speed * deltaTime);
  player.position.y = RESET_Y;

  const nearestAfter = getNearestTrackSample(player.position);
  player.lateral = nearestAfter.lateral;

  if (Math.abs(nearestAfter.lateral) > WALL_LIMIT) {
    player.position.copy(nearestAfter.point).addScaledVector(
      nearestAfter.normal,
      THREE.MathUtils.clamp(nearestAfter.lateral, -trackHalfWidth * 0.96, trackHalfWidth * 0.96),
    );
    player.position.y = RESET_Y;
    player.speed *= player.shieldTimer > 0 ? 0.92 : PLAYER_CONFIG.wallDrag;
    player.heading = dampAngle(player.heading, Math.atan2(nearestAfter.tangent.x, nearestAfter.tangent.z), 0.3);
  }

  if (allowInput && getPadHit(nearestAfter)) {
    player.boostTimer = Math.max(player.boostTimer, 1.1);
  }

  updatePlayerProgress(nearestAfter);

  player.steerVisual = THREE.MathUtils.lerp(
    player.steerVisual,
    steerInput * (input.drift ? 1.3 : 0.8),
    1 - Math.exp(-deltaTime * 10),
  );
  player.mesh.position.copy(player.position);
  player.mesh.rotation.y = player.heading;
  player.mesh.rotation.z = -player.steerVisual * (0.08 + speedRatio * 0.08);

  player.shield.visible = player.shieldTimer > 0;
  if (player.shield.visible) {
    const pulse = 1 + Math.sin(raceState.timer * 8) * 0.05;
    player.shield.scale.setScalar(pulse);
  }
}

function updatePlayerProgress(nearestTrackSample) {
  const previousT = player.t;
  const currentT = nearestTrackSample.t;
  let delta = currentT - previousT;

  if (delta > 0.5) {
    delta -= 1;
  } else if (delta < -0.5) {
    delta += 1;
  }

  if (delta > 0) {
    const sector = Math.floor(currentT * CHECKPOINT_COUNT) % CHECKPOINT_COUNT;
    if (sector > 0) {
      player.sectors.add(sector);
    }
  }

  if (delta > 0 && previousT > 0.84 && currentT < 0.18) {
    if (player.sectors.size >= CHECKPOINT_COUNT - 1) {
      player.lap += 1;
      player.sectors = new Set();

      if (player.lap >= LAPS_TO_WIN && player.finishedAt === null) {
        player.finishedAt = raceState.timer;
        raceState.finishers.push(player.id);
        player.finishPosition = raceState.finishers.length;
        endRace();
      }
    }
  }

  player.t = currentT;
}

function updateAi(ai, deltaTime, activeRace) {
  if (ai.finishedAt !== null) {
    placeAiMesh(ai);
    return;
  }

  const blocker = getAiBlocker(ai);
  const pressureBoost = getRacerProgress(player) > ai.progress ? 2.8 : 0;
  const launchBonus = activeRace && raceState.timer < 1.8 ? ai.launchBoost * (1 - raceState.timer / 1.8) : 0;
  const paceWave = Math.sin(raceState.timer * (0.65 + (ai.baseSpeed - 53) * 0.012) + ai.pacePhase) * 5.6;
  const laneWave = Math.sin(raceState.timer * 0.8 + ai.lanePhase + THREE.MathUtils.euclideanModulo(ai.progress, 1) * Math.PI * 2) * 1.35;

  let desiredSpeed = activeRace ? ai.baseSpeed + pressureBoost + launchBonus + paceWave : 0;
  let desiredOffset = ai.offsetBase + laneWave;

  if (blocker) {
    const gapRatio = 1 - blocker.gap / 0.06;
    const overtakeDirection = blocker.offset >= ai.offset ? -1 : 1;
    desiredOffset = blocker.offset + overtakeDirection * (4 + gapRatio * 1.4);
    desiredSpeed += 4.5 * gapRatio;

    if (Math.abs(blocker.offset - ai.offset) < 2.6) {
      desiredSpeed -= 9.5 * gapRatio;
    }
  }

  desiredOffset = THREE.MathUtils.clamp(desiredOffset, -trackHalfWidth * 0.76, trackHalfWidth * 0.76);
  ai.targetOffset = desiredOffset;
  ai.offset = moveToward(ai.offset, ai.targetOffset, 12 * deltaTime);
  ai.speed = moveToward(ai.speed, desiredSpeed, (activeRace ? 28 : 14) * deltaTime);
  ai.speed = THREE.MathUtils.clamp(ai.speed, 0, ai.maxSpeed);
  ai.progress += (ai.speed * deltaTime) / track.length;
  const normalizedProgress = THREE.MathUtils.euclideanModulo(ai.progress, 1);
  ai.lap = Math.floor(ai.progress);

  if (ai.lap >= LAPS_TO_WIN && ai.finishedAt === null) {
    ai.finishedAt = raceState.timer;
    raceState.finishers.push(ai.id);
  }

  for (const pad of track.boostPads) {
    if (Math.abs(wrapUnitDelta(normalizedProgress, pad.t)) < 0.012 && Math.abs(ai.offset - pad.offset) < 2.5) {
      ai.progress += 0.0035;
    }
  }

  placeAiMesh(ai);
}

function getAiBlocker(ai) {
  let bestBlocker = null;
  const candidates = [player, ...aiRacers];

  for (const other of candidates) {
    if (other === ai) {
      continue;
    }

    if (other.finishedAt !== null) {
      continue;
    }

    const otherProgress = getRacerProgress(other);
    const gap = otherProgress - ai.progress;
    if (gap <= 0 || gap > 0.06) {
      continue;
    }

    const otherOffset = getRacerOffset(other);
    if (Math.abs(otherOffset - ai.offset) > 4.8) {
      continue;
    }

    if (!bestBlocker || gap < bestBlocker.gap) {
      bestBlocker = {
        racer: other,
        gap,
        offset: otherOffset,
      };
    }
  }

  return bestBlocker;
}

function placeAiMesh(ai) {
  const t = THREE.MathUtils.euclideanModulo(ai.progress, 1);
  const sample = sampleTrack(track.curve, t);
  ai.mesh.position.copy(sample.point).addScaledVector(sample.normal, ai.offset);
  ai.mesh.position.y = RESET_Y;
  ai.mesh.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + Math.sin(raceState.timer * 5 + ai.wobble) * 0.04;
  ai.mesh.rotation.z = Math.sin(raceState.timer * 6 + ai.wobble) * 0.04;
}

function resolveKartCollisions() {
  const racers = [player, ...aiRacers.filter((ai) => ai.finishedAt === null)];

  for (let i = 0; i < racers.length; i += 1) {
    for (let j = i + 1; j < racers.length; j += 1) {
      const left = racers[i];
      const right = racers[j];
      const leftPosition = getRacerWorldPosition(left);
      const rightPosition = getRacerWorldPosition(right);
      const delta = tmpVecC.subVectors(rightPosition, leftPosition);
      let distance = delta.length();
      const minDistance = KART_RADIUS * 2;

      if (distance >= minDistance) {
        continue;
      }

      if (distance < 0.001) {
        delta.set(1, 0, 0);
        distance = 1;
      } else {
        delta.divideScalar(distance);
      }

      const overlap = minDistance - distance;
      applyCollisionPush(left, delta, -1, overlap, right === player && player.shieldTimer > 0);
      applyCollisionPush(right, delta, 1, overlap, left === player && player.shieldTimer > 0);
    }
  }
}

function applyCollisionPush(racer, direction, sign, overlap, hitByShield) {
  const pushVector = tmpVecD.copy(direction).multiplyScalar(sign * overlap * 0.5);
  const worldPosition = getRacerWorldPosition(racer);
  const sample = getNearestTrackSample(worldPosition);
  const lateralPush = pushVector.dot(sample.normal);

  if (racer === player) {
    const damping = player.shieldTimer > 0 ? 0.18 : 0.5;
    player.position.addScaledVector(direction, sign * overlap * damping);
    player.position.y = RESET_Y;
    player.speed *= player.shieldTimer > 0 ? 0.995 : 0.965;
    player.lateral = getNearestTrackSample(player.position).lateral;
  } else {
    const force = hitByShield ? 1.8 : 1;
    racer.offset = THREE.MathUtils.clamp(
      racer.offset + lateralPush * 1.5 * force,
      -trackHalfWidth * 0.8,
      trackHalfWidth * 0.8,
    );
    racer.targetOffset = racer.offset;
    racer.speed *= hitByShield ? 0.88 : 0.95;
    placeAiMesh(racer);
  }
}

function updateItemBoxes(deltaTime, activeRace) {
  for (const box of track.itemBoxes) {
    if (!box.active) {
      box.respawnTimer -= deltaTime;
      if (box.respawnTimer <= 0) {
        box.active = true;
        box.mesh.visible = true;
      }
      continue;
    }

    if (!activeRace || player.item) {
      continue;
    }

    if (box.mesh.position.distanceTo(player.position) < 4) {
      collectItemBox(box);
    }
  }
}

function collectItemBox(box) {
  box.active = false;
  box.respawnTimer = ITEM_BOX_RESPAWN;
  box.mesh.visible = false;
  player.item = randomItem();
  setMessage(`Picked up ${ITEM_LABELS[player.item]}.`, 2.4);
}

function usePlayerItem() {
  if (!player.item || raceState.phase !== "racing") {
    return;
  }

  const item = player.item;
  player.item = null;

  if (item === "turbo") {
    player.boostTimer = Math.max(player.boostTimer, 2.3);
    setMessage("Turbo ignited.");
    return;
  }

  if (item === "shield") {
    player.shieldTimer = Math.max(player.shieldTimer, 6);
    setMessage("Shield online.");
    return;
  }

  if (item === "pulse") {
    let hits = 0;
    for (const ai of aiRacers) {
      if (ai.finishedAt !== null) {
        continue;
      }

      const distance = ai.mesh.position.distanceTo(player.position);
      if (distance > 14) {
        continue;
      }

      hits += 1;
      ai.speed *= 0.62;
      ai.offset = THREE.MathUtils.clamp(
        ai.offset + Math.sign(ai.offset || 1) * 2.6,
        -trackHalfWidth * 0.8,
        trackHalfWidth * 0.8,
      );
      ai.targetOffset = ai.offset;
      ai.progress = Math.max(ai.lap, ai.progress - 0.004);
      placeAiMesh(ai);
    }

    setMessage(hits > 0 ? `Pulse hit ${hits} rival${hits > 1 ? "s" : ""}.` : "Pulse fired.");
  }
}

function randomItem() {
  const roll = Math.random();
  if (roll < 0.36) {
    return "turbo";
  }
  if (roll < 0.68) {
    return "shield";
  }
  return "pulse";
}

function updateTrackObjects(deltaTime) {
  if (!track) {
    return;
  }

  for (const box of track.itemBoxes) {
    if (!box.active) {
      continue;
    }

    box.mesh.rotation.y += deltaTime * 1.9;
    box.mesh.position.y = 2.1 + Math.sin(raceState.timer * 3.5 + box.bobPhase) * 0.35;
  }
}

function updatePlacements() {
  const standings = [
    {
      id: player.id,
      progress: getRacerProgress(player),
      finishedAt: player.finishedAt,
    },
    ...aiRacers.map((ai) => ({
      id: ai.id,
      progress: ai.progress,
      finishedAt: ai.finishedAt,
    })),
  ];

  standings.sort((left, right) => {
    if (left.finishedAt !== null || right.finishedAt !== null) {
      if (left.finishedAt === null) {
        return 1;
      }
      if (right.finishedAt === null) {
        return -1;
      }
      return left.finishedAt - right.finishedAt;
    }
    return right.progress - left.progress;
  });

  const place = standings.findIndex((entry) => entry.id === player.id) + 1;
  player.finishPosition = player.finishedAt !== null ? player.finishPosition : place;
}

function updateCamera(deltaTime) {
  if (raceState.phase === "menu") {
    return;
  }

  const forward = tmpVecB.set(Math.sin(player.heading), 0, Math.cos(player.heading)).normalize();
  const speedRatio = THREE.MathUtils.clamp(Math.abs(player.speed) / PLAYER_CONFIG.maxSpeed, 0, 1);
  const cameraTarget = player.position.clone()
    .addScaledVector(forward, -15 - speedRatio * 8)
    .add(new THREE.Vector3(0, 9 + speedRatio * 3, 0));
  camera.position.lerp(cameraTarget, 1 - Math.exp(-deltaTime * 4.5));

  const lookTarget = player.position.clone()
    .addScaledVector(forward, 11)
    .add(new THREE.Vector3(0, 3.4, 0));
  cameraLookTarget.lerp(lookTarget, 1 - Math.exp(-deltaTime * 5));
  camera.lookAt(cameraLookTarget);
}

function animateMenuCamera() {
  const orbitTime = performance.now() * 0.00012;
  const radius = 108;
  camera.position.set(Math.cos(orbitTime) * radius, 48, Math.sin(orbitTime) * radius);
  camera.lookAt(0, 0, 0);
}

function syncHud() {
  hud.lap.textContent = `${Math.min(player.lap + 1, LAPS_TO_WIN)} / ${LAPS_TO_WIN}`;
  hud.place.textContent = ordinal(player.finishPosition ?? 1);
  hud.speed.textContent = `${Math.max(0, Math.round(Math.abs(player.speed) * 2.4))} km/h`;
  hud.timer.textContent = formatTime(raceState.timer);
  hud.track.textContent = track.name;
  hud.item.textContent = player.item ? `${ITEM_LABELS[player.item]} [Space]` : (player.shieldTimer > 0 ? "Shield Active" : "Empty");

  if (raceState.phase === "menu") {
    hud.countdown.classList.add("hidden");
  }

  if (raceState.messageText) {
    hud.message.textContent = raceState.messageText;
    hud.message.classList.remove("hidden");
  } else {
    hud.message.classList.add("hidden");
  }
}

function setMessage(text, duration = 2.2) {
  raceState.messageText = text;
  raceState.messageTimer = text ? duration : 0;
}

function endRace() {
  raceState.phase = "finished";
  hud.finish.classList.remove("hidden");
  hud.finishTitle.textContent = `${ordinal(player.finishPosition)} Place`;
  hud.finishSummary.textContent = `${track.name} finished in ${formatTime(player.finishedAt ?? raceState.timer)}. Press Enter, Space, or the button to race again.`;
  setMessage("");
}

function resetPlayerToTrack() {
  const sample = sampleTrack(track.curve, player.t);
  player.position.copy(sample.point).addScaledVector(sample.normal, THREE.MathUtils.clamp(player.lateral, -3, 3));
  player.position.y = RESET_Y;
  player.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
  player.speed = 0;
  player.boostTimer = 0;
  player.driftCharge = 0;
  player.mesh.position.copy(player.position);
  player.mesh.rotation.set(0, player.heading, 0);
}

function updateTrackButtons() {
  hud.trackButtons.forEach((button) => {
    const isActive = Number(button.dataset.trackIndex) === raceState.selectedTrackIndex;
    button.classList.toggle("active", isActive);
  });
}

function clearInputState() {
  input.accelerate = false;
  input.brake = false;
  input.left = false;
  input.right = false;
  input.drift = false;
}

function getNearestTrackSample(position) {
  let nearest = track.samples[0];
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const sample of track.samples) {
    const distance = sample.point.distanceToSquared(position);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearest = sample;
    }
  }

  const offset = position.clone().sub(nearest.point);
  return {
    ...nearest,
    lateral: offset.dot(nearest.normal),
    forwardOffset: offset.dot(nearest.tangent),
  };
}

function getPadHit(nearestTrackSample) {
  return track.boostPads.find((pad) => {
    const tDelta = Math.abs(wrapUnitDelta(nearestTrackSample.t, pad.t));
    return tDelta < 0.014 && Math.abs(nearestTrackSample.lateral - pad.offset) < 2.8;
  });
}

function getRacerProgress(racer) {
  return racer === player ? player.lap + player.t : racer.progress;
}

function getRacerOffset(racer) {
  return racer === player ? player.lateral : racer.offset;
}

function getRacerWorldPosition(racer) {
  return racer === player ? player.position : racer.mesh.position;
}

function sampleTrack(curve, t) {
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return { point, tangent, normal };
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function pushQuad(target, a, b, c, d) {
  target.push(
    a.x, a.y, a.z,
    b.x, b.y, b.z,
    c.x, c.y, c.z,
    a.x, a.y, a.z,
    c.x, c.y, c.z,
    d.x, d.y, d.z,
  );
}

function pushNormals(target, count) {
  for (let index = 0; index < count; index += 1) {
    target.push(0, 1, 0);
  }
}

function moveToward(value, target, delta) {
  if (value < target) {
    return Math.min(value + delta, target);
  }
  return Math.max(value - delta, target);
}

function dampAngle(current, target, factor) {
  const delta = wrapAngleDelta(target, current);
  return current + delta * factor;
}

function wrapAngleDelta(next, current) {
  let delta = next - current;
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return delta;
}

function wrapUnitDelta(next, current) {
  let delta = next - current;
  while (delta > 0.5) {
    delta -= 1;
  }
  while (delta < -0.5) {
    delta += 1;
  }
  return delta;
}

function ordinal(value) {
  if (value % 100 >= 11 && value % 100 <= 13) {
    return `${value}th`;
  }
  const remainder = value % 10;
  if (remainder === 1) {
    return `${value}st`;
  }
  if (remainder === 2) {
    return `${value}nd`;
  }
  if (remainder === 3) {
    return `${value}rd`;
  }
  return `${value}th`;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const wholeSeconds = Math.floor(remainder);
  const milliseconds = Math.floor((remainder - wholeSeconds) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}
