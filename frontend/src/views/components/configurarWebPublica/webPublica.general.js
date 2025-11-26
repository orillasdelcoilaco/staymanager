// frontend/src/views/components/configurarWebPublica/webPublica.general.js
import { fetchAPI } from '../../../api.js';

let settings = { seo: {}, content: {}, theme: {}, general: {} };

// Helper para evitar "undefined" en los inputs
const clean = (val) => {
    if (val === undefined || val === null || val === 'undefined') return '';
    return val;
};

export function renderGeneral(datosSettings) {
    settings = datosSettings || {};
    const general = settings.general || {};
    const theme = settings.theme || {};
    const seo = settings.seo || {};
    const content = settings.content || {};

    return `
        <div id="general-settings-container">
            <fieldset class="border p-4 rounded-md mb-4">
                <legend class="px-2 font-semibold text-gray-700">Configuración General</legend>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div><label class="block text-sm font-medium">Subdominio</label><input type="text" id="config-subdomain" class="form-input mt-1" value="${clean(general.subdomain)}" placeholder="ej: miempresa"></div>
                    <div><label class="block text-sm font-medium">Dominio Personalizado</label><input type="text" id="config-domain" class="form-input mt-1" value="${clean(general.domain)}" placeholder="ej: miempresa.com"></div>
                    <div><label class="block text-sm font-medium">URL del Logo</label><input type="url" id="config-logo" class="form-input mt-1" value="${clean(theme.logoUrl)}"></div>
                    <div><label class="block text-sm font-medium">Color Primario</label><input type="color" id="config-color-primary" class="form-input h-10 p-1 mt-1" value="${clean(theme.primaryColor) || '#000000'}"></div>
                    <div><label class="block text-sm font-medium">Color Secundario</label><input type="color" id="config-color-secondary" class="form-input h-10 p-1 mt-1" value="${clean(theme.secondaryColor) || '#FFFFFF'}"></div>
                </div>
            </fieldset>

            <fieldset class="border p-4 rounded-md mb-4">
                <legend class="px-2 font-semibold text-gray-700">Textos (Página de Inicio)</legend>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div><label class="block text-sm font-medium">Meta Título (SEO)</label><input type="text" id="home-seo-title" class="form-input mt-1" value="${clean(seo.homeTitle)}"></div>
                    <div><label class="block text-sm font-medium">Meta Descripción (SEO)</label><input type="text" id="home-seo-description" class="form-input mt-1" value="${clean(seo.homeDescription)}"></div>
                    <div><label class="block text-sm font-medium">Título Principal (H1)</label><input type="text" id="home-h1" class="form-input mt-1" value="${clean(content.homeH1)}"></div>
                    <div class="md:col-span-2"><label class="block text-sm font-medium">Párrafo Introductorio</label><textarea id="home-intro" rows="3" class="form-input mt-1">${clean(content.homeIntro)}</textarea></div>
                </div>
                <div class="mt-4 flex gap-2">
                    <button type="button" id="btn-generar-home-seo" class="btn-secondary btn-sm">Generar SEO con IA</button>
                    <button type="button" id="btn-generar-home-content" class="btn-secondary btn-sm">Generar H1/Intro con IA</button>
                </div>
            </fieldset>

            <fieldset class="border p-4 rounded-md mb-4">
                <legend class="px-2 font-semibold text-gray-700">Imagen de Portada (Hero)</legend>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 items-start">
                    <div>
                        <label class="block text-sm font-medium">Subir/Reemplazar Imagen Portada</label>
                        <input type="file" id="upload-hero-image-input" accept="image/*" class="form-input-file mt-1">
                        <label class="block text-sm font-medium mt-2">Texto Alternativo (Alt)</label><input type="text" id="upload-hero-alt-input" class="form-input mt-1" placeholder="Descripción para SEO..." value="${clean(theme.heroImageAlt)}">
                        <label class="block text-sm font-medium mt-2">Título (Title)</label><input type="text" id="upload-hero-title-input" class="form-input mt-1" placeholder="Título de la imagen..." value="${clean(theme.heroImageTitle)}">
                        <button type="button" id="upload-hero-image-btn" class="btn-secondary btn-sm mt-3">Subir Imagen Portada</button>
                        <div id="upload-hero-status" class="text-xs mt-1"></div>
                    </div>
                    <div id="hero-preview-container">
                        <p class="text-xs text-gray-600 mb-2 font-medium">Vista Previa Actual:</p>
                        ${theme.heroImageUrl ? 
                            `<img src="${theme.heroImageUrl}" alt="Vista previa portada" class="w-full h-32 object-cover rounded-md border bg-gray-100">` :
                            '<div class="w-full h-32 flex items-center justify-center bg-gray-100 text-gray-400 rounded-md border">Sin imagen</div>'
                        }
                    </div>
                </div>
            </fieldset>
            
            <div class="text-right border-t pt-4">
                <button type="button" id="save-empresa-config-btn" class="btn-primary btn-lg">Guardar Configuración General</button>
            </div>
        </div>
    `;
}

export function setupGeneralEvents() {
    const attach = (id, handler) => {
        const el = document.getElementById(id);
        if (el) {
            // Clonar para eliminar listeners previos si se vuelve a renderizar
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            newEl.addEventListener('click', handler);
        } else {
            console.warn(`[ConfigWeb] Botón no encontrado: ${id}`);
        }
    };

    attach('btn-generar-home-seo', () => generarTextosHomeIA('seo'));
    attach('btn-generar-home-content', () => generarTextosHomeIA('content'));
    attach('save-empresa-config-btn', guardarTextosHome);
    attach('upload-hero-image-btn', handleSubirHeroImage);
}

async function generarTextosHomeIA(tipo) {
    const btnId = tipo === 'seo' ? 'btn-generar-home-seo' : 'btn-generar-home-content';
    const btn = document.getElementById(btnId);
    if(btn) {
        btn.disabled = true;
        btn.textContent = 'Generando...';
    }

    try {
        const endpoint = tipo === 'seo' ? '/website-config/generate-ai-home-seo' : '/website-config/generate-ai-home-content';
        const data = await fetchAPI(endpoint, { method: 'POST' });

        if (tipo === 'seo') {
            document.getElementById('home-seo-title').value = clean(data.homeTitle);
            document.getElementById('home-seo-description').value = clean(data.homeDescription);
        } else {
            document.getElementById('home-h1').value = clean(data.homeH1);
            document.getElementById('home-intro').value = clean(data.homeIntro);
        }
    } catch (error) {
        alert(`Error generando textos con IA: ${error.message}`);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.textContent = tipo === 'seo' ? 'Generar SEO con IA' : 'Generar H1/Intro con IA';
        }
    }
}

async function guardarTextosHome() {
    const btn = document.getElementById('save-empresa-config-btn');
    if(btn) {
        btn.disabled = true;
        btn.textContent = 'Guardando...';
    }

    const payload = {
        general: {
            subdomain: document.getElementById('config-subdomain').value,
            domain: document.getElementById('config-domain').value
        },
        theme: {
            logoUrl: document.getElementById('config-logo').value,
            primaryColor: document.getElementById('config-color-primary').value,
            secondaryColor: document.getElementById('config-color-secondary').value
        },
        content: {
            homeH1: document.getElementById('home-h1').value,
            homeIntro: document.getElementById('home-intro').value
        },
        seo: {
            homeTitle: document.getElementById('home-seo-title').value,
            homeDescription: document.getElementById('home-seo-description').value
        }
    };

    try {
        await fetchAPI('/website-config/home-settings', { method: 'PUT', body: payload });
        alert('Configuración general guardada con éxito.');
    } catch (error) {
        alert(`Error al guardar: ${error.message}`);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.textContent = 'Guardar Configuración General';
        }
    }
}

async function handleSubirHeroImage() {
    const input = document.getElementById('upload-hero-image-input');
    const file = input.files?.[0];
    if (!file) return alert('Selecciona una imagen primero.');

    const btn = document.getElementById('upload-hero-image-btn');
    const statusEl = document.getElementById('upload-hero-status');
    
    if(btn) btn.disabled = true;
    if(statusEl) statusEl.textContent = 'Subiendo...';

    const formData = new FormData();
    formData.append('heroImage', file);
    formData.append('altText', document.getElementById('upload-hero-alt-input').value);
    formData.append('titleText', document.getElementById('upload-hero-title-input').value);

    try {
        const result = await fetchAPI('/website-config/upload-hero-image', { method: 'POST', body: formData });
        const previewContainer = document.getElementById('hero-preview-container');
        previewContainer.innerHTML = `
            <p class="text-xs text-gray-600 mb-2 font-medium">Vista Previa Actual:</p>
            <img src="${result['websiteSettings.theme.heroImageUrl']}" alt="Vista previa portada" class="w-full h-32 object-cover rounded-md border bg-gray-100">
        `;
        if(statusEl) statusEl.textContent = 'Imagen de portada subida con éxito.';
    } catch (error) {
        if(statusEl) statusEl.textContent = `Error: ${error.message}`;
    } finally {
        if(btn) btn.disabled = false;
    }
}