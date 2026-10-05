// The real 3D iPhone for the tutorial kit: the GLB model (devices/iphone.glb) lit by a photo studio
// (devices/studio.hdr, Poly Haven CC0), with whatever the kit paints on a 2D "screen" canvas mapped onto the glass.
// Rendered with three.js (vendored in vendor/, MIT) into a transparent WebGL canvas the size of the film frame,
// which the kit draws like any image. Returns null when WebGL or the files aren't available; the kit then falls
// back to the flat frame, so a film always renders.
//
//   const p3 = await phone3d(W, H);
//   p3.screen            a 2D canvas: paint the app screen here (glass-sized, black bezel included)
//   p3.inset             { x, y, w, h }: where the screenshot sits on that canvas, inside the bezel
//   p3.draw(rect, turn)  renders the phone so its glass covers rect {x, y, w, h} (frame px); turn = { yaw, pitch }
//                        in radians. Returns the WebGL canvas.
const load = (src) => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.append(s); });

export async function phone3d(W, H, { tint = '#9a9ba0' } = {}) {
  try {
    if (!window.THREE) { await load('/kit/vendor/three.min.js'); await load('/kit/vendor/GLTFLoader.js'); await load('/kit/vendor/RGBELoader.js'); }
    const T = window.THREE, canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene();
    const hdr = await new Promise((ok, bad) => new T.RGBELoader().load('/kit/devices/studio.hdr', ok, undefined, bad));
    hdr.mapping = T.EquirectangularReflectionMapping;
    scene.environment = new T.PMREMGenerator(renderer).fromEquirectangular(hdr).texture;
    const gltf = await new Promise((ok, bad) => new T.GLTFLoader().load('/kit/devices/iphone.glb', ok, undefined, bad));
    const model = gltf.scene;
    // the glass: its flat bounds give the screen's size, and planar UVs so the whole canvas lands on it
    let glass = null;
    model.traverse((o) => { if (o.isMesh && o.name.startsWith('front-glass')) glass = o; });
    if (!glass) return null;
    model.updateWorldMatrix(true, true);
    const g = glass.geometry; g.computeBoundingBox();
    const gb = g.boundingBox, pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) - gb.min.x) / (gb.max.x - gb.min.x); uv[i * 2 + 1] = (pos.getY(i) - gb.min.y) / (gb.max.y - gb.min.y); }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    // glass size in world units (after the node's own scale), and which way it faces
    const gs = new T.Vector3(); new T.Box3().setFromObject(glass).getSize(gs);
    const glassW = Math.min(gs.x, gs.y) === gs.x ? gs.x : gs.x, glassH = gs.y;
    // the screen canvas: glass-shaped, black bezel, the app screen inset like a real iPhone's
    const screen = document.createElement('canvas');
    screen.width = 1200; screen.height = Math.round(1200 * glassH / glassW);
    const bz = Math.round(screen.width * 0.032), iw = screen.width - 2 * bz, ih = Math.round(iw * 1688 / 780);
    const inset = { x: bz, y: Math.round((screen.height - ih) / 2), w: iw, h: ih };
    const tex = new T.CanvasTexture(screen); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
    glass.material = new T.MeshPhysicalMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.92, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.35 });
    model.traverse((o) => {
      if (!o.isMesh || o === glass) return;
      o.material = o.material.clone();
      if (/aluminium|plateau/.test(o.material.name)) { o.material.color.set(tint); Object.assign(o.material, { metalness: 1, roughness: 0.26, envMapIntensity: 1.4 }); }
    });
    // face the glass to the camera (+Z), centred on the glass
    const fp = new T.Vector3(), bp = new T.Vector3(); glass.getWorldPosition(fp);
    model.traverse((o) => { if (o.name.startsWith('rear-window')) o.getWorldPosition(bp); });
    const pivot = new T.Group(), holder = new T.Group();
    if (fp.z < bp.z) model.rotation.y = Math.PI;
    model.updateWorldMatrix(true, true);
    const gc = new T.Vector3(); new T.Box3().setFromObject(glass).getCenter(gc);
    model.position.sub(gc);
    holder.add(model); pivot.add(holder); scene.add(pivot);
    // a long lens: 1 world unit = 1 frame pixel at z = 0, with only gentle perspective
    const fov = 14, dist = (H / 2) / Math.tan((fov * Math.PI) / 360);
    const cam = new T.PerspectiveCamera(fov, W / H, dist / 20, dist * 4);
    cam.position.set(0, 0, dist); cam.lookAt(0, 0, 0);
    return {
      screen, inset,
      draw(rect, { yaw = 0, pitch = 0 } = {}) {
        tex.needsUpdate = true;
        const s = rect.w / glassW;
        pivot.position.set(rect.x + rect.w / 2 - W / 2, H / 2 - (rect.y + rect.h / 2), 0);
        holder.scale.setScalar(s);
        pivot.rotation.set(pitch, yaw, 0);
        renderer.render(scene, cam);
        return canvas;
      },
    };
  } catch (e) {
    console.error(`3D phone unavailable (${e.message}); using the flat frame`);
    return null;
  }
}
