// Three.js view of the world: globe, ocean, atmosphere, clouds, stars and creatures.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { G, hslToRgb } from './life.js';
import { makeNoise3, mulberry32 } from './rng.js';

const LAND_H = 0.045;  // terrain exaggeration above sea level
const SEA_H = 0.03;    // depth exaggeration below

export function surfaceRadius(e) {
  return 1 + (e > 0 ? e * LAND_H : e * SEA_H);
}

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.overlay = 'biome';
    this.highlightSpecies = 0;
    this.selected = -1;
    this.follow = false;
    this.showClouds = true;

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
    this.buildGlobe();
    this.buildAtmosphere();
    this.buildClouds();
    this.buildCreatures();
    this.buildCursor();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setWorld(world) {
    this.world = world;
    this.planetGroup.remove(this.globe);
    this.globe.geometry.dispose();
    this.buildGlobe();
    this.updateTerrain();
    this.selected = -1;
    this.follow = false;
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
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
        // bands of cloud along the equator and mid-latitudes
        v += 0.12 * Math.cos(lat * 6);
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

  buildCreatures() {
    const max = this.world.life.max;
    const mk = (geo) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6 }), max);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      m.renderOrder = 2;
      this.planetGroup.add(m);
      return m;
    };
    this.grazers = mk(new THREE.IcosahedronGeometry(1, 0));
    this.hunters = mk(new THREE.TetrahedronGeometry(1.35, 0));

    const ring = new THREE.RingGeometry(1.4, 1.9, 24);
    this.marker = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffd27a, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }));
    this.marker.visible = false;
    this.marker.renderOrder = 5;
    this.planetGroup.add(this.marker);
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
    this.world.planet.colors(this.colorBuf, this.overlay);
    this.globe.geometry.attributes.color.needsUpdate = true;
    this.ocean.visible = this.overlay === 'biome' || this.overlay === 'life';
  }

  // world-space position of a cell on the surface (on the water surface for sea cells)
  cellSurface(c, out) {
    const P = this.world.planet;
    const r = surfaceRadius(Math.max(P.elev[c], P.seaLevel));
    const p = P.grid.pos;
    return out.set(p[c * 3] * r, p[c * 3 + 1] * r, p[c * 3 + 2] * r);
  }

  updateCreatures(alpha) {
    const L = this.world.life, P = this.world.planet;
    const pos = P.grid.pos;
    const gm = this.grazers.instanceMatrix.array, hm = this.hunters.instanceMatrix.array;
    const gc = this.grazers.instanceColor.array, hc = this.hunters.instanceColor.array;
    const dist = this.camera.position.length();
    const vis = Math.min(2.6, Math.max(1, (dist - 1) * 0.9)); // keep creatures visible when zoomed out
    const hl = this.highlightSpecies;
    let ng = 0, nh = 0;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < L.hi; i++) {
      if (!L.alive[i]) continue;
      const a = L.prevCell[i], b = L.cell[i];
      const ra = surfaceRadius(Math.max(P.elev[a], P.seaLevel));
      const rb = surfaceRadius(Math.max(P.elev[b], P.seaLevel));
      let x = pos[a * 3] * ra + (pos[b * 3] * rb - pos[a * 3] * ra) * alpha;
      let y = pos[a * 3 + 1] * ra + (pos[b * 3 + 1] * rb - pos[a * 3 + 1] * ra) * alpha;
      let z = pos[a * 3 + 2] * ra + (pos[b * 3 + 2] * rb - pos[a * 3 + 2] * ra) * alpha;
      // small per-creature offset so crowds don't stack exactly
      const jx = L.jitter[i * 2] * 0.006, jy = L.jitter[i * 2 + 1] * 0.006;
      x += jx; y += jy; z += -jx * 0.5 + jy * 0.5;
      const size = 0.3 + 2.7 * L.genes[i * G];
      const s = (0.0022 + 0.0016 * Math.sqrt(size)) * vis;
      tmp.set(x, y, z).normalize();
      x += tmp.x * s; y += tmp.y * s; z += tmp.z * s;

      let [r, g, bl] = hslToRgb(L.genes[i * G + 6], 0.75, 0.55);
      if (hl && L.species[i] !== hl) { r *= 0.18; g *= 0.18; bl *= 0.18; }
      const hunter = L.genes[i * G + 2] > 0.5;
      const m = hunter ? hm : gm, col = hunter ? hc : gc;
      const k = hunter ? nh++ : ng++;
      const o = k * 16;
      m[o] = s; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
      m[o + 4] = 0; m[o + 5] = s; m[o + 6] = 0; m[o + 7] = 0;
      m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = s; m[o + 11] = 0;
      m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
      col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = bl;

      if (i === this.selected) {
        this.marker.position.set(x, y, z);
        this.marker.scale.setScalar(s * 1.1);
        this.marker.lookAt(x * 2, y * 2, z * 2);
        this.selectedPos = this.marker.position;
      }
    }
    this.grazers.count = ng;
    this.hunters.count = nh;
    this.grazers.instanceMatrix.needsUpdate = true;
    this.hunters.instanceMatrix.needsUpdate = true;
    this.grazers.instanceColor.needsUpdate = true;
    this.hunters.instanceColor.needsUpdate = true;

    if (this.selected >= 0 && !L.alive[this.selected]) { this.selected = -1; this.follow = false; }
    this.marker.visible = this.selected >= 0;
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

  launchMeteor(cell, onImpact) {
    const target = this.cellSurface(cell, new THREE.Vector3());
    const n = target.clone().normalize();
    const side = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    if (side.lengthSq() < 0.1) side.set(1, 0, 0);
    const from = n.clone().multiplyScalar(2.6).addScaledVector(side, 1.2);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.018, 0), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
    const trailGeo = new THREE.BufferGeometry().setFromPoints([from.clone(), from.clone()]);
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8 }));
    this.planetGroup.add(rock, trail);
    this.effects = this.effects || [];
    this.effects.push({ t: 0, dur: 0.9, update: (e) => {
      const k = Math.min(1, e.t / e.dur);
      const p = from.clone().lerp(target, k * k);
      rock.position.copy(p);
      const a = trailGeo.attributes.position;
      const tail = from.clone().lerp(target, Math.max(0, k * k - 0.25));
      a.setXYZ(0, tail.x, tail.y, tail.z); a.setXYZ(1, p.x, p.y, p.z); a.needsUpdate = true;
      if (k >= 1) {
        this.planetGroup.remove(rock, trail);
        rock.geometry.dispose(); trailGeo.dispose();
        this.flash(target);
        onImpact();
        return false;
      }
      return true;
    } });
  }

  flash(at) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
    ball.position.copy(at);
    this.planetGroup.add(ball);
    this.shake = 0.5;
    this.effects.push({ t: 0, dur: 1.6, update: (e) => {
      const k = e.t / e.dur;
      ball.scale.setScalar(0.02 + 0.3 * Math.sqrt(k));
      mat.opacity = Math.max(0, 1 - k);
      mat.color.setRGB(1, 0.85 - 0.5 * k, 0.6 - 0.5 * k);
      if (k >= 1) { this.planetGroup.remove(ball); ball.geometry.dispose(); mat.dispose(); return false; }
      return true;
    } });
  }

  // nearest living creature to a cell (within a few cells)
  nearestCreature(cell) {
    const L = this.world.life, pos = this.world.planet.grid.pos;
    let best = -1, bd = Math.cos(0.03);
    for (let i = 0; i < L.hi; i++) {
      if (!L.alive[i]) continue;
      const c = L.cell[i];
      const d = pos[c * 3] * pos[cell * 3] + pos[c * 3 + 1] * pos[cell * 3 + 1] + pos[c * 3 + 2] * pos[cell * 3 + 2];
      if (d > bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---------- frame ----------

  render(dt, alpha) {
    const cam = this.camera;
    const dist = cam.position.length();
    this.controls.rotateSpeed = Math.min(1, Math.max(0.08, (dist - 1) * 0.55));
    if (this.follow && this.selectedPos) {
      // swing the camera to keep the selected creature centred
      const want = this.selectedPos.clone().normalize().multiplyScalar(dist);
      cam.position.lerp(want, Math.min(1, dt * 2.5));
      cam.position.setLength(dist);
    }
    this.controls.update();

    // light comes from over the viewer's shoulder so the side you're looking at is lit
    const off = new THREE.Vector3(-2.2, 1.6, 1.5).applyMatrix4(cam.matrixWorld);
    this.sun.position.copy(off);

    if (this.effects) {
      // effects may add new effects while updating, so collect survivors into a fresh list
      const list = this.effects;
      this.effects = [];
      for (const e of list) { e.t += dt; if (e.update(e)) this.effects.push(e); }
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.02;
      cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s;
    }
    this.clouds.rotation.y += dt * 0.012;
    // clouds thin out as you zoom in, so the surface stays readable
    this.clouds.visible = this.showClouds && (this.overlay === 'biome' || this.overlay === 'life');
    this.clouds.material.opacity = Math.max(0, Math.min(0.75, (dist - 1.25) * 0.9));
    this.updateCreatures(alpha);
    this.renderer.render(this.scene, cam);
  }
}
