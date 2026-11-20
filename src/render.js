// Three.js view of the world: globe, ocean, atmosphere, clouds, stars, and the life icons that
// show which kinds of life live in each zone.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { KINGDOMS, MAXT } from './ecosystem.js';
import { makeNoise3, mulberry32 } from './rng.js';

const LAND_H = 0.045;  // terrain exaggeration above sea level
const SEA_H = 0.03;    // depth exaggeration below
const ATLAS_GRID = 12; // icons per atlas row
const ATLAS_CELL = 80;

export function surfaceRadius(e) {
  return 1 + (e > 0 ? e * LAND_H : e * SEA_H);
}

function hsl(h, s, l) {
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

export function speciesRGB(sp, l = 0.55) {
  const h = sp.hue, s = 0.62;
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.overlay = 'biome';
    this.highlight = null;   // species whose range is highlighted
    this.showClouds = true;
    this.showIcons = true;
    this.effects = [];

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050b);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.005, 200);
    this.camera.position.set(0.6, 0.9, 3.4);

    const c = (this.controls = new OrbitControls(this.camera, canvas));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.minDistance = 1.09;
    c.maxDistance = 7;
    c.zoomSpeed = 0.8;
    c.autoRotateSpeed = 0.35;

    this.scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x20160c, 0.55));
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.1);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.planetGroup = new THREE.Group();
    this.scene.add(this.planetGroup);

    this.buildStars();
    this.buildOcean();
    this.buildAtmosphere();
    this.buildGlobe();
    this.buildClouds();
    this.buildIcons();
    this.buildCursor();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setWorld(world) {
    this.world = world;
    this.planetGroup.remove(this.globe);
    this.globe.geometry.dispose();
    this.buildGlobe();
    this.highlight = null;
    this.updateTerrain();
    this.updateIcons();
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.iconMat) this.iconMat.uniforms.uMaxPx.value = 34 * this.renderer.getPixelRatio();
    if (this.iconMat) this.iconMat.uniforms.uScale.value = this.renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
  }

  // ---------- scene pieces ----------

  buildStars() {
    const rng = mulberry32(99);
    const n = 4000;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rng() * 2 - 1, t = rng() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const R = 60 + rng() * 40;
      pos.set([R * s * Math.cos(t), R * u, R * s * Math.sin(t)], i * 3);
      const b = 0.4 + rng() * 0.6, warm = rng();
      col.set([b * (0.85 + 0.15 * warm), b * 0.9, b * (1 - 0.2 * warm)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true })));
  }

  buildGlobe() {
    const P = this.world.planet;
    const g = new THREE.BufferGeometry();
    this.positions = new Float32Array(P.n * 3);
    this.colorBuf = new Float32Array(P.n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.colorBuf, 3));
    g.setIndex(new THREE.BufferAttribute(P.grid.index, 1));
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
    this.globe = new THREE.Mesh(g, m);
    this.planetGroup.add(this.globe);
    this.updateTerrain();
  }

  buildOcean() {
    const g = new THREE.IcosahedronGeometry(1, 24);
    const m = new THREE.MeshPhongMaterial({
      color: 0x1b4f8a, transparent: true, opacity: 0.42, shininess: 90,
      specular: 0x88aacc, depthWrite: false,
    });
    this.ocean = new THREE.Mesh(g, m);
    this.ocean.renderOrder = 1;
    this.planetGroup.add(this.ocean);
  }

  buildAtmosphere() {
    const g = new THREE.SphereGeometry(1.16, 64, 32);
    const m = new THREE.ShaderMaterial({
      uniforms: { glow: { value: new THREE.Color(0x4a8dff) } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 glow; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(clamp(0.62 + dot(vN, vV), 0.0, 1.0), 4.0); gl_FragColor = vec4(glow*f*1.4, f); }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    this.atmosphere = new THREE.Mesh(g, m);
    this.scene.add(this.atmosphere);
  }

  buildClouds() {
    const W = 512, H = 256;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const N = makeNoise3(mulberry32(this.world.seed + 5));
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI;
      for (let x = 0; x < W; x++) {
        const lon = (x / W) * Math.PI * 2;
        const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
        let v = N.fbm(px * 2.2, py * 4.5, pz * 2.2, 5) * 1.4 + 0.08;
        v += 0.12 * Math.cos(lat * 6); // cloud bands along the equator and mid-latitudes
        const a = Math.max(0, Math.min(1, (v - 0.08) * 3));
        const k = (y * W + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
        img.data[k + 3] = a * 210;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.75 });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.055, 96, 48), m);
    this.clouds.renderOrder = 3;
    this.scene.add(this.clouds);
  }

  // Life icons: one billboard point per icon, sampled from an atlas of emoji drawn on round,
  // kingdom-coloured badges. Zoomed out, each zone shows its most notable life; zoomed in, up to three.
  buildIcons() {
    const cv = (this.atlasCanvas = document.createElement('canvas'));
    cv.width = cv.height = ATLAS_GRID * ATLAS_CELL;
    this.atlasCtx = cv.getContext('2d');
    this.atlasIndex = new Map();
    this.atlasTex = new THREE.CanvasTexture(cv);
    this.atlasTex.colorSpace = THREE.SRGBColorSpace;
    this.atlasTex.generateMipmaps = true;
    this.atlasTex.minFilter = THREE.LinearMipmapLinearFilter;

    const max = this.world.eco.Z * 4;
    const g = new THREE.BufferGeometry();
    this.iconPos = new Float32Array(max * 3);
    this.iconCell = new Float32Array(max * 2);
    this.iconSize = new Float32Array(max);
    this.iconRank = new Float32Array(max);
    this.iconLod = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.iconPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCell', new THREE.BufferAttribute(this.iconCell, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.iconSize, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRank', new THREE.BufferAttribute(this.iconRank, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aLod', new THREE.BufferAttribute(this.iconLod, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.iconMat = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: this.atlasTex }, uGrid: { value: ATLAS_GRID }, uScale: { value: 800 },
        uZoomIn: { value: 0 }, uLod: { value: 2 }, uMaxPx: { value: 40 }, uCam: { value: new THREE.Vector3() },
      },
      vertexShader: `
        attribute vec2 aCell; attribute float aSize; attribute float aRank; attribute float aLod;
        uniform float uScale; uniform float uZoomIn; uniform float uLod; uniform float uMaxPx; uniform vec3 uCam;
        varying vec2 vCell; varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vec3 n = normalize(position);
          float facing = dot(n, normalize(uCam - position));
          // aRank 0: always shown; 1: only zoomed out (a zone's top icon, centred); 2: only zoomed in (grouped)
          float show = aRank < 0.5 ? 1.0 : aRank < 1.5 ? 1.0 - uZoomIn : uZoomIn;
          // zoomed far out, only zones on a coarser nested grid show icons
          if (aLod > uLod + 0.5) show = 0.0;
          vAlpha = smoothstep(0.08, 0.4, facing) * show;
          gl_PointSize = min(uMaxPx, aSize * uScale / -mv.z);
          vCell = aCell;
        }`,
      fragmentShader: `
        uniform sampler2D uAtlas; uniform float uGrid;
        varying vec2 vCell; varying float vAlpha;
        void main() {
          if (vAlpha < 0.02) discard;
          vec2 uv = vec2((vCell.x + gl_PointCoord.x) / uGrid, 1.0 - (vCell.y + gl_PointCoord.y) / uGrid);
          vec4 c = texture2D(uAtlas, uv);
          if (c.a * vAlpha < 0.06) discard;
          gl_FragColor = vec4(c.rgb, c.a * vAlpha);
        }`,
      transparent: true, depthWrite: false,
    });
    this.icons = new THREE.Points(g, this.iconMat);
    this.icons.renderOrder = 4;
    this.icons.frustumCulled = false;
    this.planetGroup.add(this.icons);
  }

  atlasSlot(icon, kingdom) {
    const key = icon + '|' + kingdom;
    let i = this.atlasIndex.get(key);
    if (i !== undefined) return i;
    i = this.atlasIndex.size;
    if (i >= ATLAS_GRID * ATLAS_GRID) return 0;
    this.atlasIndex.set(key, i);
    const ctx = this.atlasCtx, S = ATLAS_CELL;
    const x = (i % ATLAS_GRID) * S, y = Math.floor(i / ATLAS_GRID) * S;
    const cx = x + S / 2, cy = y + S / 2, r = S * 0.44;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,12,22,0.55)'; ctx.fill();
    ctx.lineWidth = S * 0.06; ctx.strokeStyle = KINGDOMS[kingdom]?.color || '#ccc'; ctx.stroke();
    ctx.font = `${Math.round(S * 0.5)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy + S * 0.03);
    ctx.restore();
    this.atlasTex.needsUpdate = true;
    return i;
  }

  // rebuild the icon layer from the current biosphere
  updateIcons() {
    const W = this.world, E = W.eco, P = W.planet;
    const zp = E.zgrid.pos;
    const hl = this.highlight && this.highlight.died < 0 ? this.highlight : null;
    let n = 0;
    const up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
    const OFFS = [[0, 0.5], [-0.62, -0.45], [0.62, -0.45]];
    let lod = 0;
    const put = (sp, x, y, z, size, rank) => {
      const slot = this.atlasSlot(sp.icon, sp.kingdom);
      this.iconPos[n * 3] = x; this.iconPos[n * 3 + 1] = y; this.iconPos[n * 3 + 2] = z;
      this.iconCell[n * 2] = slot % ATLAS_GRID;
      this.iconCell[n * 2 + 1] = Math.floor(slot / ATLAS_GRID);
      this.iconSize[n] = size;
      this.iconRank[n] = rank;
      this.iconLod[n] = lod;
      n++;
    };
    for (let z = 0; z < E.Z && this.showIcons; z++) {
      const list = hl ? (E.B[z * MAXT + hl.slot] > 1e-4 ? [hl] : []) : E.zoneIcons(z);
      if (!list.length) continue;
      // the zone grid is nested: the first 162 / 642 zones form coarser geodesic grids
      lod = z < 162 ? 0 : z < 642 ? 1 : 2;
      // zone z's centre is terrain vertex z
      const r = surfaceRadius(Math.max(P.elev[z], P.seaLevel)) + 0.012;
      nrm.set(zp[z * 3], zp[z * 3 + 1], zp[z * 3 + 2]);
      t1.crossVectors(nrm, Math.abs(nrm.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up).normalize();
      t2.crossVectors(nrm, t1);
      const cx = nrm.x * r, cy = nrm.y * r, cz = nrm.z * r;
      if (list.length === 1) { put(list[0], cx, cy, cz, 0.044, 0); continue; }
      put(list[0], cx, cy, cz, 0.044, 1);
      const d = this.groupSpacing || 0.02;
      for (let k = 0; k < list.length; k++) {
        const o = OFFS[k];
        put(list[k], cx + (t1.x * o[0] + t2.x * o[1]) * d, cy + (t1.y * o[0] + t2.y * o[1]) * d, cz + (t1.z * o[0] + t2.z * o[1]) * d, k === 0 ? 0.04 : 0.034, 2);
      }
    }
    this.icons.geometry.setDrawRange(0, n);
    const g = this.icons.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aCell.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aRank.needsUpdate = true;
    g.attributes.aLod.needsUpdate = true;
  }

  buildCursor() {
    const pts = [];
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    this.cursor = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.85, depthTest: false }));
    this.cursor.visible = false;
    this.cursor.renderOrder = 6;
    this.planetGroup.add(this.cursor);
  }

  // ---------- updates ----------

  updateTerrain() {
    const P = this.world.planet;
    const pos = P.grid.pos;
    for (let i = 0; i < P.n; i++) {
      const r = surfaceRadius(P.elev[i]);
      this.positions[i * 3] = pos[i * 3] * r;
      this.positions[i * 3 + 1] = pos[i * 3 + 1] * r;
      this.positions[i * 3 + 2] = pos[i * 3 + 2] * r;
    }
    const geo = this.globe.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.computeBoundingSphere();
    this.ocean.scale.setScalar(surfaceRadius(P.seaLevel) + 0.0008);
    this.updateColors();
  }

  updateColors() {
    const W = this.world, P = W.planet, E = W.eco;
    const out = this.colorBuf;
    if (this.overlay === 'plates') {
      // each tectonic plate in its own colour; boundaries dark, volcanic belts glowing
      const T = W.tect, nb = P.grid;
      for (let c = 0; c < P.n; c++) {
        const p = T.label[c];
        const h = (p * 0.618) % 1;
        let [r, g, b] = hsl(h, 0.45, P.water[c] ? 0.32 : 0.55);
        let edge = false;
        for (let k = nb.nbrStart[c]; k < nb.nbrStart[c + 1]; k++) if (T.label[nb.nbr[k]] !== p) edge = true;
        if (edge) { r *= 0.35; g *= 0.35; b *= 0.35; }
        const v = P.volc[c];
        if (v > 0.5) { r = r * 0.5 + 0.5; g = g * 0.6 + 0.15; b *= 0.5; }
        out[c * 3] = r; out[c * 3 + 1] = g; out[c * 3 + 2] = b;
      }
    } else if (this.overlay === 'endemics') {
      // species found in 15 zones or fewer: islands, mountain tops and isolated basins light up
      const n = new Uint8Array(E.Z);
      for (let z = 0; z < E.Z; z++) {
        for (let a = 0; a < E.presN[z]; a++) {
          const sp = E.slots[E.pres[z * MAXT + a]];
          if (sp && sp.range <= 15 && E.B[z * MAXT + sp.slot] > 1e-4) n[z]++;
        }
      }
      for (let c = 0; c < P.n; c++) {
        const v = Math.min(1, n[E.zoneOf[c]] / 4);
        const w = P.water[c] ? 0.5 : 1;
        out[c * 3] = (0.1 + 0.85 * v) * w; out[c * 3 + 1] = (0.1 + 0.35 * v) * w; out[c * 3 + 2] = (0.18 + 0.55 * v) * w;
      }
    } else if (this.overlay === 'diversity') {
      // number of species per zone
      for (let c = 0; c < P.n; c++) {
        const z = E.zoneOf[c];
        const v = Math.min(1, E.presN[z] / 30);
        const w = P.water[c] ? 0.55 : 1;
        out[c * 3] = (0.08 + 0.9 * v * v) * w; out[c * 3 + 1] = (0.07 + 0.7 * v) * w; out[c * 3 + 2] = (0.14 + 0.3 * (1 - v)) * w;
      }
    } else {
      P.colors(out, this.overlay);
    }
    const hl = this.highlight && this.highlight.died < 0 ? this.highlight : null;
    if (hl) {
      const [hr, hg, hb] = speciesRGB(hl, 0.6);
      for (let c = 0; c < P.n; c++) {
        const inRange = E.B[E.zoneOf[c] * MAXT + hl.slot] > 1e-4;
        if (inRange) { out[c * 3] = out[c * 3] * 0.45 + hr * 0.55; out[c * 3 + 1] = out[c * 3 + 1] * 0.45 + hg * 0.55; out[c * 3 + 2] = out[c * 3 + 2] * 0.45 + hb * 0.55; }
        else { out[c * 3] *= 0.4; out[c * 3 + 1] *= 0.4; out[c * 3 + 2] *= 0.4; }
      }
    }
    this.globe.geometry.attributes.color.needsUpdate = true;
    this.ocean.visible = this.overlay === 'biome';
    // the sky and sea change with the atmosphere: hazy orange and green under CO₂ and methane,
    // blue once oxygen builds up
    const ox = Math.min(1, P.o2 / 8);
    this.atmosphere.material.uniforms.glow.value.setRGB(0.95 - 0.66 * ox, 0.55 + 0.0 * ox, 0.3 + 0.7 * ox);
    this.ocean.material.color.setRGB(0.22 - 0.11 * ox, 0.36 - 0.05 * ox, 0.25 + 0.29 * ox);
  }

  cellSurface(c, out) {
    const P = this.world.planet;
    const r = surfaceRadius(Math.max(P.elev[c], P.seaLevel));
    const p = P.grid.pos;
    return out.set(p[c * 3] * r, p[c * 3 + 1] * r, p[c * 3 + 2] * r);
  }

  showCursor(cell, radius) {
    if (cell < 0) { this.cursor.visible = false; return; }
    const p = this.cellSurface(cell, new THREE.Vector3());
    const n = p.clone().normalize();
    this.cursor.position.copy(n).multiplyScalar(p.length() + 0.004);
    this.cursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    this.cursor.scale.setScalar(Math.sin(radius) * p.length());
    this.cursor.visible = true;
  }

  // ---------- picking ----------

  pickCell(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const P = this.world.planet;
    // intersect a sphere at the local surface height, refining the radius twice
    let r = surfaceRadius(P.seaLevel), c = this.lastPick ?? 0;
    const pt = new THREE.Vector3();
    for (let iter = 0; iter < 3; iter++) {
      if (!ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), r), pt)) {
        if (iter === 0) return -1;
        break;
      }
      c = this.nearestCell(pt.clone().normalize(), c);
      r = surfaceRadius(Math.max(P.elev[c], P.seaLevel));
    }
    this.lastPick = c;
    return c;
  }

  // greedy walk over the grid to the vertex nearest a unit direction
  nearestCell(dir, start) {
    const { pos, nbrStart, nbr } = this.world.planet.grid;
    const dot = (i) => pos[i * 3] * dir.x + pos[i * 3 + 1] * dir.y + pos[i * 3 + 2] * dir.z;
    let c = start, best = dot(c), moved = true;
    while (moved) {
      moved = false;
      for (let k = nbrStart[c]; k < nbrStart[c + 1]; k++) {
        const d = dot(nbr[k]);
        if (d > best) { best = d; c = nbr[k]; moved = true; }
      }
    }
    return c;
  }

  // ---------- effects ----------

  // something falling from space: a rocky meteor (orange) or an icy comet (blue-white)
  launchMeteor(cell, onImpact, kind = 'meteor') {
    const target = this.cellSurface(cell, new THREE.Vector3());
    const n = target.clone().normalize();
    const side = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    if (side.lengthSq() < 0.1) side.set(1, 0, 0);
    const from = n.clone().multiplyScalar(2.6).addScaledVector(side, 1.2);
    const comet = kind === 'comet';
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(comet ? 0.012 : 0.018, 0), new THREE.MeshBasicMaterial({ color: comet ? 0xd8f0ff : 0xffc070 }));
    const trailGeo = new THREE.BufferGeometry().setFromPoints([from.clone(), from.clone()]);
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: comet ? 0x9fd8ff : 0xffa040, transparent: true, opacity: 0.8 }));
    this.planetGroup.add(rock, trail);
    this.effects.push({ t: 0, dur: comet ? 0.7 : 0.9, update: (e) => {
      const k = Math.min(1, e.t / e.dur);
      const p = from.clone().lerp(target, k * k);
      rock.position.copy(p);
      const a = trailGeo.attributes.position;
      const tail = from.clone().lerp(target, Math.max(0, k * k - (comet ? 0.4 : 0.25)));
      a.setXYZ(0, tail.x, tail.y, tail.z); a.setXYZ(1, p.x, p.y, p.z); a.needsUpdate = true;
      if (k >= 1) {
        this.planetGroup.remove(rock, trail);
        rock.geometry.dispose(); trailGeo.dispose();
        this.flash(target, comet ? 0xbfe6ff : 0xffd9a0, comet ? 0.12 : 0.3);
        onImpact?.();
        return false;
      }
      return true;
    } });
  }

  flash(at, color = 0xffd9a0, size = 0.3) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
    ball.position.copy(at);
    this.planetGroup.add(ball);
    if (size > 0.2) this.shake = 0.5;
    const base = new THREE.Color(color);
    this.effects.push({ t: 0, dur: 1.4, update: (e) => {
      const k = e.t / e.dur;
      ball.scale.setScalar(0.02 + size * Math.sqrt(k));
      mat.opacity = Math.max(0, 1 - k);
      mat.color.copy(base).multiplyScalar(1 - 0.5 * k);
      if (k >= 1) { this.planetGroup.remove(ball); ball.geometry.dispose(); mat.dispose(); return false; }
      return true;
    } });
  }

  // a forked bolt from the sky to the surface
  lightning(cell) {
    const target = this.cellSurface(cell, new THREE.Vector3());
    const n = target.clone().normalize();
    const pts = [];
    const side = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const side2 = n.clone().cross(side);
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      const p = target.clone().addScaledVector(n, 0.09 * (1 - k));
      if (i > 0 && i < 8) p.addScaledVector(side, (Math.random() - 0.5) * 0.02).addScaledVector(side2, (Math.random() - 0.5) * 0.02);
      pts.push(p);
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 1 });
    const bolt = new THREE.Line(g, mat);
    this.planetGroup.add(bolt);
    this.effects.push({ t: 0, dur: 0.35, update: (e) => {
      mat.opacity = Math.random() > 0.3 ? 1 - e.t / e.dur : 0.2;
      if (e.t >= e.dur) { this.planetGroup.remove(bolt); g.dispose(); mat.dispose(); return false; }
      return true;
    } });
  }

  // ---------- frame ----------

  render(dt) {
    const cam = this.camera;
    const dist = cam.position.length();
    this.controls.rotateSpeed = Math.min(1, Math.max(0.08, (dist - 1) * 0.55));
    this.controls.update();

    // light comes from over the viewer's shoulder so the side you're looking at is lit
    const off = new THREE.Vector3(-2.2, 1.6, 1.5).applyMatrix4(cam.matrixWorld);
    this.sun.position.copy(off);

    // effects may add new effects while updating, so collect survivors into a fresh list
    const list = this.effects;
    this.effects = [];
    for (const e of list) { e.t += dt; if (e.update(e)) this.effects.push(e); }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.02;
      cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s;
    }
    this.clouds.rotation.y += dt * 0.012;
    // clouds thin out as you zoom in, so the surface stays readable
    this.clouds.visible = this.showClouds && this.overlay === 'biome';
    this.clouds.material.opacity = Math.max(0, Math.min(0.75, (dist - 1.25) * 0.9));

    // zoomed in: up to three icons per zone; zoomed out: one
    this.iconMat.uniforms.uZoomIn.value = dist < 1.75 ? 1 : 0;
    // spread a zone's icon group so capped-size icons just touch at the current zoom
    const want = Math.min(0.02, Math.max(0.006, 0.018 * (dist - 1) / 0.6));
    if (Math.abs(want - (this.groupSpacing || 0.02)) > 0.0015) { this.groupSpacing = want; this.updateIcons(); }
    this.iconMat.uniforms.uLod.value = dist > 3.0 ? 1 : 2;
    this.iconMat.uniforms.uCam.value.copy(cam.position);
    this.renderer.render(this.scene, cam);
  }
}
