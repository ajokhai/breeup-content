#!/usr/bin/env node
// Renders the real 3D iPhone and MacBook (tools/kit/devices/*.glb, from the HyperFrames registry block
// vfx-iphone-device, Apache-2.0) head-on into transparent PNG frames with the screen cut out, for the
// tutorial kit to lay over screenshots. Run once; the PNGs and frames.json are committed, so renders never
// need the network. Needs the network itself (three.js from jsDelivr).
//
//   node tools/frames.mjs            # writes tools/kit/devices/{phone,laptop}-frame.png + frames.json
//
// frames.json: { phone: { w, h, screen: [x, y, w, h], notch }, laptop: {...} }: the screen hole in frame pixels,
// and how far a notch hangs into it from the top (the kit starts the screenshot below it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'kit', 'devices');
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.147.0';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.route('http://frames.local/**', (r) => {
  const f = path.join(DIR, path.basename(new URL(r.request().url()).pathname));
  return fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f), contentType: 'model/gltf-binary' }) : r.fulfill({ body: '<!doctype html><body></body>', contentType: 'text/html' });
});
await page.goto('http://frames.local/index.html');
for (const s of ['build/three.min.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/environments/RoomEnvironment.js']) await page.addScriptTag({ url: `${THREE}/${s}` });
page.on('console', (m) => m.type() === 'error' && console.error('page:', m.text()));

// screen: the mesh that becomes the hole; long: frame size in px along its longest side
async function render(file, screen, long, tint) {
  return page.evaluate(async ({ file, screen, long, tint }) => {
    const gltf = await new Promise((ok, bad) => new THREE.GLTFLoader().load(`http://frames.local/${file}`, ok, undefined, bad));
    const root = gltf.scene, isScreen = (o) => o.isMesh && o.name.replace(/\.\d+$/, '') === screen;
    root.updateWorldMatrix(true, true);
    let scr; root.traverse((o) => { if (isScreen(o)) scr = o; });
    // the screen's facing direction: its geometry is a flat panel, so the normal of its thinnest axis
    scr.geometry.computeBoundingBox();
    const sb = scr.geometry.boundingBox, ext = sb.getSize(new THREE.Vector3());
    const axis = ext.x < ext.y && ext.x < ext.z ? new THREE.Vector3(1, 0, 0) : ext.y < ext.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const nm = new THREE.Matrix3().getNormalMatrix(scr.matrixWorld);
    const normal = axis.applyMatrix3(nm).normalize();
    const centre = sb.getCenter(new THREE.Vector3()).applyMatrix4(scr.matrixWorld);
    const scene = new THREE.Scene(); scene.add(root);
    // neutral black-titanium / space-black finish whatever colour the model shipped in
    root.traverse((o) => { if (o.isMesh && /aluminium|plateau|space-black|antenna/.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set(tint); } });
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 0.6); key.position.copy(normal).multiplyScalar(10).add(new THREE.Vector3(-4, 6, 0)); scene.add(key);
    const mats = new Map(); root.traverse((o) => { if (o.isMesh) mats.set(o, o.material); });
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    // the screen's normal could point either way: shoot from both sides and keep the one where the screen shows
    let shot;
    for (const side of [1, -1]) { shot = frame(normal.clone().multiplyScalar(side)); if (shot.screen[2] > 10) break; }
    const { cam, W, H } = shot;
    function frame(normal) {
    // an orthographic camera square-on to the screen, framing the whole device as seen from there
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 1000);
    const up = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    cam.up.copy(up); cam.position.copy(centre).addScaledVector(normal, 50); cam.lookAt(centre); cam.updateMatrixWorld();
    const pts = []; root.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld).applyMatrix4(cam.matrixWorldInverse)); } });
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x)), minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
    const pad = 0.02 * Math.max(maxX - minX, maxY - minY);
    Object.assign(cam, { left: minX - pad, right: maxX + pad, top: maxY + pad, bottom: minY - pad }); cam.updateProjectionMatrix();
    const aspect = (cam.right - cam.left) / (cam.top - cam.bottom);
    const W = Math.round(aspect >= 1 ? long : long * aspect), H = Math.round(aspect >= 1 ? long / aspect : long);
    renderer.setSize(W, H, false);
    // pass 1: the screen alone in pure white, to measure the hole
    root.traverse((o) => { if (o.isMesh) o.material = isScreen(o) ? white : black; });
    renderer.render(scene, cam);
    const gl = renderer.getContext(), px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4] > 200) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); const yy = H - 1 - y; y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); }
    key.position.copy(normal).multiplyScalar(10).add(new THREE.Vector3(-4, 6, 0));
    return { cam, W, H, screen: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] };
    }
    // pass 2: the real materials, the screen punched out to transparent
    root.traverse((o) => { if (o.isMesh) o.material = isScreen(o) ? new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0, blending: THREE.NoBlending }) : mats.get(o); });
    renderer.render(scene, cam);
    // a notch (MacBook) hangs into the hole from the top edge: measure how far, down the middle column
    const gl2 = renderer.getContext(), col = new Uint8Array(4 * H);
    gl2.readPixels(Math.round(shot.screen[0] + shot.screen[2] / 2), 0, 1, H, gl2.RGBA, gl2.UNSIGNED_BYTE, col);
    let notch = 0;
    for (let yy = shot.screen[1]; yy < shot.screen[1] + shot.screen[3] / 4; yy++) { if (col[(H - 1 - yy) * 4 + 3] > 128) notch = yy - shot.screen[1] + 1; else if (notch) break; }
    const png = renderer.domElement.toDataURL('image/png');
    scene.remove(root); renderer.dispose();
    return { w: W, h: H, screen: shot.screen, notch, png };
  }, { file, screen, long, tint });
}

const meta = {};
for (const [name, file, screen, long, tint] of [['phone', 'iphone.glb', 'front-glass', 2400, '#3b3b3e'], ['laptop', 'macbook.glb', 'display', 3200, '#2e3033']]) {
  const r = await render(file, screen, long, tint);
  fs.writeFileSync(path.join(DIR, `${name}-frame.png`), Buffer.from(r.png.split(',')[1], 'base64'));
  meta[name] = { w: r.w, h: r.h, screen: r.screen, notch: r.notch };
  console.log(`${name}-frame.png ${r.w}x${r.h}, screen ${r.screen.join(',')}, notch ${r.notch}`);
}
fs.writeFileSync(path.join(DIR, 'frames.json'), JSON.stringify(meta, null, 1) + '\n');
await browser.close();
