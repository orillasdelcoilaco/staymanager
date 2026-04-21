/**
 * galeria.editor.js — Lightbox y editor de fotos (rotar, recortar)
 */
import { fetchAPI } from '../../../api.js';

// ── Lightbox (agrandar) ───────────────────────────────────────────────────────
export function openLightbox(foto, propiedadId, onSaved) {
    removeModal('galeria-lightbox');
    const src = foto.storageUrl || foto.thumbnailUrl || '';
    const el  = document.createElement('div');
    el.id        = 'galeria-lightbox';
    el.className = 'fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center gap-4';
    el.innerHTML = `
        <button id="lb-close" class="absolute top-4 right-5 text-white/50 hover:text-white text-2xl leading-none transition-colors"><i class="fa-solid fa-xmark"></i></button>
        <img src="${esc(src)}" alt="${esc(foto.altText || '')}"
             class="max-w-[90vw] max-h-[80vh] object-contain rounded-xl shadow-2xl">
        <div class="flex items-center gap-3">
            <p class="text-white/40 text-sm">${esc(foto.espacio || foto.altText || 'Foto')}</p>
            <button id="lb-edit"
                class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-all">
                <i class="fa-solid fa-pen"></i> Editar foto
            </button>
        </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) removeModal('galeria-lightbox'); });
    document.getElementById('lb-close').addEventListener('click', () => removeModal('galeria-lightbox'));
    document.getElementById('lb-edit').addEventListener('click', () => {
        removeModal('galeria-lightbox');
        openEditor(foto, propiedadId, onSaved);
    });
}

// ── Editor (rotar + recortar) ─────────────────────────────────────────────────
export function openEditor(foto, propiedadId, onSaved) {
    removeModal('galeria-editor');
    const edState = { rotation: 0, cropMode: false, crop: { top: 0, right: 0, bottom: 0, left: 0 } };
    const workCanvas = document.createElement('canvas');
    const img = loadImage(foto.storageUrl || foto.thumbnailUrl || '');

    const el = crearEditorDOM();
    document.body.appendChild(el);

    const canvas = document.getElementById('ed-canvas');
    const ctx    = canvas.getContext('2d');

    img.onload  = () => { rotarCanvas(img, workCanvas, edState.rotation); dibujarPreview(canvas, ctx, workCanvas, edState); };
    img.onerror = () => dibujarError(canvas, ctx);

    bindEditorEvents(el, img, canvas, ctx, workCanvas, edState, foto, propiedadId, onSaved);
}

// ── Canvas ────────────────────────────────────────────────────────────────────
function rotarCanvas(img, workCanvas, rotation) {
    const rad     = rotation * Math.PI / 180;
    const sw      = img.naturalWidth, sh = img.naturalHeight;
    const rotated = rotation % 180 !== 0;
    workCanvas.width  = rotated ? sh : sw;
    workCanvas.height = rotated ? sw : sh;
    const wc = workCanvas.getContext('2d');
    wc.save();
    wc.translate(workCanvas.width / 2, workCanvas.height / 2);
    wc.rotate(rad);
    wc.drawImage(img, -sw / 2, -sh / 2);
    wc.restore();
}

function dibujarPreview(canvas, ctx, workCanvas, edState) {
    const { cropMode, crop } = edState;
    const w = workCanvas.width, h = workCanvas.height;
    canvas.width = w; canvas.height = h;
    ctx.drawImage(workCanvas, 0, 0);
    if (!cropMode) return;
    const t = pct(crop.top, h), b = pct(crop.bottom, h);
    const l = pct(crop.left, w), r = pct(crop.right, w);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0,     0,     w, t);
    ctx.fillRect(0,     h - b, w, b);
    ctx.fillRect(0,     t,     l, h - t - b);
    ctx.fillRect(w - r, t,     r, h - t - b);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    ctx.strokeRect(l, t, w - l - r, h - t - b);
}

function dibujarError(canvas, ctx) {
    canvas.width = 400; canvas.height = 260;
    ctx.fillStyle = 'rgb(17 24 39)'; ctx.fillRect(0, 0, 400, 260);
    ctx.fillStyle = 'rgb(107 114 128)'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No se pudo cargar (configurar CORS en Storage)', 200, 130);
}

function construirExport(workCanvas, edState) {
    const { cropMode, crop } = edState;
    const w = workCanvas.width, h = workCanvas.height;
    if (!cropMode || (!crop.top && !crop.bottom && !crop.left && !crop.right)) return workCanvas;
    const t = pct(crop.top, h),  b = pct(crop.bottom, h);
    const l = pct(crop.left, w), r = pct(crop.right, w);
    const out = document.createElement('canvas');
    out.width = w - l - r; out.height = h - t - b;
    out.getContext('2d').drawImage(workCanvas, l, t, out.width, out.height, 0, 0, out.width, out.height);
    return out;
}

// ── Eventos del editor ────────────────────────────────────────────────────────
function bindEditorEvents(el, img, canvas, ctx, workCanvas, edState, foto, propiedadId, onSaved) {
    const redraw = () => dibujarPreview(canvas, ctx, workCanvas, edState);

    document.getElementById('ed-close').addEventListener('click',  () => removeModal('galeria-editor'));
    document.getElementById('ed-cancel').addEventListener('click', () => removeModal('galeria-editor'));

    document.getElementById('ed-ccw').addEventListener('click', () => {
        edState.rotation = (edState.rotation - 90 + 360) % 360;
        rotarCanvas(img, workCanvas, edState.rotation); redraw();
    });
    document.getElementById('ed-cw').addEventListener('click', () => {
        edState.rotation = (edState.rotation + 90) % 360;
        rotarCanvas(img, workCanvas, edState.rotation); redraw();
    });
    document.getElementById('ed-crop').addEventListener('click', () => {
        edState.cropMode = !edState.cropMode;
        document.getElementById('ed-crop-panel').classList.toggle('hidden', !edState.cropMode);
        const btn = document.getElementById('ed-crop');
        btn.classList.toggle('bg-primary-100', edState.cropMode);
        btn.classList.toggle('text-primary-700', edState.cropMode);
        if (!edState.cropMode) edState.crop = { top: 0, right: 0, bottom: 0, left: 0 };
        redraw();
    });
    el.addEventListener('input', e => {
        if (!e.target.closest('#ed-crop-panel')) return;
        edState.crop.top    = +document.getElementById('crop-top')?.value    || 0;
        edState.crop.bottom = +document.getElementById('crop-bottom')?.value || 0;
        edState.crop.left   = +document.getElementById('crop-left')?.value   || 0;
        edState.crop.right  = +document.getElementById('crop-right')?.value  || 0;
        redraw();
    });
    document.getElementById('ed-save').addEventListener('click', () =>
        guardarFoto(workCanvas, edState, foto, propiedadId, onSaved)
    );
}

async function guardarFoto(workCanvas, edState, foto, propiedadId, onSaved) {
    const btn = document.getElementById('ed-save');
    btn.textContent = 'Guardando...'; btn.disabled = true;
    try {
        const out  = construirExport(workCanvas, edState);
        const blob = await toBlob(out);
        const fd   = new FormData();
        fd.append('image', blob, 'edited.webp');
        const result = await fetchAPI(`/galeria/${propiedadId}/${foto.id}/replace`, { method: 'POST', body: fd });
        removeModal('galeria-editor');
        if (typeof onSaved === 'function') onSaved(foto.id, result);
    } catch (err) {
        btn.textContent = 'Guardar'; btn.disabled = false;
        alert('Error al guardar: ' + (err.message || 'Intenta nuevamente'));
    }
}

// ── DOM ───────────────────────────────────────────────────────────────────────
function crearEditorDOM() {
    const el = document.createElement('div');
    el.id        = 'galeria-editor';
    el.className = 'fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4';
    el.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[95vh] overflow-hidden">
            <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
                <h3 class="font-semibold text-gray-900 text-sm">Editar foto</h3>
                <button id="ed-close" class="btn-ghost text-xl leading-none"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="flex-1 bg-gray-950 flex items-center justify-center p-4 min-h-0 overflow-hidden">
                <canvas id="ed-canvas" class="max-w-full max-h-[50vh] object-contain rounded-lg shadow-xl"></canvas>
            </div>
            <div id="ed-crop-panel" class="hidden px-5 py-4 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-x-6 gap-y-3">
                ${slider('crop-top','Superior')} ${slider('crop-bottom','Inferior')}
                ${slider('crop-left','Izquierda')} ${slider('crop-right','Derecha')}
            </div>
            <div class="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
                <div class="flex items-center gap-2">
                    <button id="ed-ccw"  class="btn-outline flex items-center gap-1.5 text-sm"><i class="fa-solid fa-rotate-left"></i> Izquierda</button>
                    <button id="ed-cw"   class="btn-outline flex items-center gap-1.5 text-sm"><i class="fa-solid fa-rotate-right"></i> Derecha</button>
                    <button id="ed-crop" class="btn-outline flex items-center gap-1.5 text-sm"><i class="fa-solid fa-crop"></i> Recortar</button>
                </div>
                <div class="flex items-center gap-2">
                    <button id="ed-cancel" class="btn-ghost text-sm">Cancelar</button>
                    <button id="ed-save"   class="px-4 py-2 rounded-xl text-sm font-semibold btn-primary">Guardar</button>
                </div>
            </div>
        </div>`;
    return el;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadImage(src) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    return img;
}

function slider(id, label) {
    return `
    <label class="flex flex-col gap-1.5">
        <div class="flex justify-between">
            <span class="text-xs text-gray-500 font-medium">${label}</span>
            <span class="text-xs text-gray-400" id="${id}-val">0%</span>
        </div>
        <input type="range" id="${id}" min="0" max="40" value="0"
               class="w-full h-1.5 accent-primary-500 cursor-pointer"
               oninput="document.getElementById('${id}-val').textContent=this.value+'%'">
    </label>`;
}

function pct(val, dim) { return Math.round(val / 100 * dim); }
function toBlob(canvas) { return new Promise(r => canvas.toBlob(r, 'image/webp', 0.9)); }
function removeModal(id) { document.getElementById(id)?.remove(); }
function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
