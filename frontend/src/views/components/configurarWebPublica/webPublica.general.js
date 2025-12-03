// frontend/src/views/components/configurarWebPublica/webPublica.general.js
import { fetchAPI } from '../../../api.js';
import { openEditor } from '../../../utils/imageEditorModal.js';

let fullEmpresaData = {};

// Helper vital para evitar "undefined" en la UI
const clean = (val) => {
    if (val === undefined || val === null || val === 'undefined') return '';
    return val;
};

export function renderGeneral(empresaData) {
    fullEmpresaData = empresaData || {};
    const settings = fullEmpresaData.websiteSettings || {};
    const general = settings.general || {};
    const theme = settings.theme || {};
    const seo = settings.seo || {};
    const content = settings.content || {};

    // Opciones para Enfoque de Marketing
    const enfoquesMarketing = ['Familiar', 'Parejas', 'Negocios', 'Aventura', 'Relax', 'Económico', 'Lujo', 'Otro'];
    const enfoqueOptions = enfoquesMarketing.map(e =>
        `<option value="${e}" ${fullEmpresaData.enfoqueMarketing === e ? 'selected' : ''}>${e}</option>`
    ).join('');

    return `
        <div id="general-settings-container">
            <fieldset class="border p-4 rounded-md mb-4">
                <legend class="px-2 font-semibold text-gray-700">Identidad y Dominio</legend>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                    
                    <!-- Sección Logo -->
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Logo del Sitio Web</label>
                        <div class="flex flex-col sm:flex-row sm:items-center sm:space-x-4 p-4 bg-gray-50 rounded border border-gray-200">
                             <img id="logo-preview" 
                                 src="${theme.logoUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='50' viewBox='0 0 100 50'%3E%3Crect width='100' height='50' fill='%23eee'/%3E%3Ctext x='50' y='25' font-family='Arial' font-size='12' fill='%23aaa' text-anchor='middle' dy='.3em'%3ESin Logo%3C/text%3E%3C/svg%3E"}" 
                                 alt="Logo actual" 
                                 class="h-16 w-auto max-w-[200px] object-contain bg-white rounded border p-2 mb-2 sm:mb-0 shadow-sm">
                             
                             <div class="flex-1">
                                <input type="file" id="logoFile" accept="image/png, image/jpeg, image/webp" class="form-input-file text-sm w-full">
                                <p class="text-xs text-gray-500 mt-1">Recomendado: PNG transparente, altura min 100px.</p>
                                <div id="logo-upload-status" class="text-xs mt-1 h-4"></div>
                             </div>
                        </div>
                        <!-- Input oculto para mantener compatibilidad si se guarda todo el form -->
                        <input type="hidden" id="config-logo" value="${clean(theme.logoUrl)}">
                    </div>

                    <div>
                        <label class="block text-sm font-medium">Subdominio (Render)</label>
                        <div class="flex items-center mt-1">
                            <!-- [MOD] Subdominio generado automáticamente y readonly -->
                            <input type="text" id="config-subdomain" class="form-input rounded-r-none bg-gray-100 text-gray-500 cursor-not-allowed" 
                                   value="${clean(general.subdomain) || clean(fullEmpresaData.nombre).toLowerCase().replace(/[^a-z0-9]/g, '')}" 
                                   readonly>
                            <span class="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md h-10">.onrender.com</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Generado automáticamente a partir del nombre de tu empresa.</p>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium">Dominio Personalizado</label>
                        <input type="text" id="config-domain" class="form-input mt-1" value="${clean(general.domain)}" placeholder="ej: www.miempresa.com">
                        <p class="text-xs text-gray-500 mt-1">Si no tienes uno, usaremos: <span class="font-mono text-xs">${clean(general.subdomain) || clean(fullEmpresaData.nombre).toLowerCase().replace(/[^a-z0-9]/g, '')}.suitemanager.com</span></p>
                    </div>

                    <div><label class="block text-sm font-medium">Color Primario</label><input type="color" id="config-color-primary" class="form-input h-10 p-1 mt-1" value="${clean(theme.primaryColor) || '#000000'}"></div>
                    <div><label class="block text-sm font-medium">Color Secundario</label><input type="color" id="config-color-secondary" class="form-input h-10 p-1 mt-1" value="${clean(theme.secondaryColor) || '#FFFFFF'}"></div>
                </div>
            </fieldset>

            <fieldset class="border p-4 rounded-md bg-indigo-50 border-indigo-100 mb-4">
                <legend class="px-2 font-semibold text-indigo-800 flex items-center gap-2">
                    ✨ Identidad y Optimización IA
                </legend>
                <div class="mt-4">
                    <label for="historiaEmpresa" class="block text-sm font-medium text-gray-700">Historia / Identidad de la Empresa</label>
                    <p class="text-xs text-gray-500 mb-2">Cuéntanos sobre tu empresa: ¿Qué la hace única? ¿A quién está dirigida? ¿Dónde está ubicada? (La IA usará esto para optimizar tu perfil).</p>
                    <div class="flex gap-2">
                        <textarea id="historiaEmpresa" name="historiaEmpresa" rows="4" class="form-input flex-1" placeholder="Ej: Somos un complejo de cabañas familiar ubicado a orillas del lago...">${clean(fullEmpresaData.historiaEmpresa)}</textarea>
                        <button type="button" id="btn-optimizar-ia" class="btn-secondary flex flex-col items-center justify-center px-4 py-2 h-auto gap-1 bg-white border-indigo-200 hover:bg-indigo-50 text-indigo-700">
                            <span class="text-xl">✨</span>
                            <span class="text-xs font-bold">Optimizar</span>
                        </button>
                    </div>
                </div>
            </fieldset>

            <fieldset class="border p-4 rounded-md mb-4">
                <legend class="px-2 font-semibold text-gray-700">Información para IA y SEO (Resultado)</legend>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                    <div class="md:col-span-3">
                        <label for="slogan" class="block text-sm font-medium text-gray-700">Slogan o Bajada de Título</label>
                        <input type="text" id="slogan" name="slogan" value="${clean(fullEmpresaData.slogan)}" class="mt-1 form-input" placeholder="Frase corta y atractiva">
                    </div>
                    <div>
                        <label for="tipoAlojamientoPrincipal" class="block text-sm font-medium text-gray-700">Tipo Principal Alojamiento</label>
                        <input type="text" id="tipoAlojamientoPrincipal" name="tipoAlojamientoPrincipal" value="${clean(fullEmpresaData.tipoAlojamientoPrincipal)}" class="mt-1 form-input" placeholder="Ej: Cabañas con tinaja">
                    </div>
                    <div>
                        <label for="enfoqueMarketing" class="block text-sm font-medium text-gray-700">Enfoque de Marketing</label>
                        <select id="enfoqueMarketing" name="enfoqueMarketing" class="mt-1 form-select">
                            <option value="">-- Selecciona --</option>
                            ${enfoqueOptions}
                        </select>
                    </div>
                    <div class="md:col-span-3">
                        <label for="palabrasClaveAdicionales" class="block text-sm font-medium text-gray-700">Palabras Clave Adicionales (separadas por coma)</label>
                        <input type="text" id="palabrasClaveAdicionales" name="palabrasClaveAdicionales" value="${clean(fullEmpresaData.palabrasClaveAdicionales)}" class="mt-1 form-input" placeholder="Ej: turismo aventura, cerca del lago, pet friendly">
                    </div>
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
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            newEl.addEventListener('click', handler);
        }
    };

    attach('btn-generar-home-seo', () => generarTextosHomeIA('seo'));
    attach('btn-generar-home-content', () => generarTextosHomeIA('content'));
    attach('save-empresa-config-btn', guardarTextosHome);

    // Botón Subir Hero
    attach('upload-hero-image-btn', () => {
        const input = document.getElementById('upload-hero-image-input');
        const file = input.files?.[0];
        if (!file) return alert('Selecciona una imagen primero.');
        openEditor(file, (editedBlob) => handleSubirHeroImage(editedBlob));
    });

    // Listener para Subir Logo (Directo al cambiar el archivo)
    const logoInput = document.getElementById('logoFile');
    if (logoInput) {
        // Usamos replaceChild hack o removeEventListener para evitar duplicados si se llama varias veces
        const newLogoInput = logoInput.cloneNode(true);
        logoInput.parentNode.replaceChild(newLogoInput, logoInput);

        newLogoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleSubirLogo(file);
        });
    }

    // *** LISTENER PARA OPTIMIZAR CON IA (ESTRATEGIA COMPLETA) ***
    const btnOptimizar = document.getElementById('btn-optimizar-ia');
    if (btnOptimizar) {
        // Clonar para limpiar listeners previos
        const newBtn = btnOptimizar.cloneNode(true);
        btnOptimizar.parentNode.replaceChild(newBtn, btnOptimizar);

        newBtn.addEventListener('click', async () => {
            const historiaInput = document.getElementById('historiaEmpresa');
            const historia = historiaInput.value;

            if (!historia || historia.length < 10) {
                return alert('Por favor, escribe una historia más detallada para que la IA pueda trabajar.');
            }

            const originalText = newBtn.innerHTML;
            newBtn.disabled = true;
            newBtn.innerHTML = '<span class="animate-spin">↻</span> Creando Estrategia...';

            try {
                const optimizedData = await fetchAPI('/website/optimize-profile', {
                    method: 'POST',
                    body: { historia }
                });

                // 1. Identidad y Estrategia
                if (optimizedData.slogan) document.getElementById('slogan').value = optimizedData.slogan;
                if (optimizedData.tipoAlojamientoPrincipal) document.getElementById('tipoAlojamientoPrincipal').value = optimizedData.tipoAlojamientoPrincipal;
                if (optimizedData.palabrasClaveAdicionales) document.getElementById('palabrasClaveAdicionales').value = optimizedData.palabrasClaveAdicionales;
                if (optimizedData.enfoqueMarketing) document.getElementById('enfoqueMarketing').value = optimizedData.enfoqueMarketing;

                // 2. Hero Image (Branding)
                if (optimizedData.heroAlt) document.getElementById('upload-hero-alt-input').value = optimizedData.heroAlt;
                if (optimizedData.heroTitle) document.getElementById('upload-hero-title-input').value = optimizedData.heroTitle;

                // 3. SEO Home Page
                if (optimizedData.homeSeoTitle) document.getElementById('home-seo-title').value = optimizedData.homeSeoTitle;
                if (optimizedData.homeSeoDesc) document.getElementById('home-seo-description').value = optimizedData.homeSeoDesc;

                // 4. Contenido Home (H1 + Intro)
                if (optimizedData.homeH1) document.getElementById('home-h1').value = optimizedData.homeH1;
                if (optimizedData.homeIntro) document.getElementById('home-intro').value = optimizedData.homeIntro;

                // 5. Historia Optimizada
                if (optimizedData.historiaOptimizada) {
                    historiaInput.value = optimizedData.historiaOptimizada;
                    historiaInput.classList.add('bg-green-50', 'transition-colors', 'duration-500');
                    setTimeout(() => historiaInput.classList.remove('bg-green-50'), 2000);
                }

                if (optimizedData.error) {
                    alert('Aviso: ' + optimizedData.error);
                } else {
                    alert('¡Estrategia Digital Generada! Hemos optimizado tu perfil, SEO y contenidos de portada.');
                }

            } catch (error) {
                alert('Error al optimizar: ' + error.message);
            } finally {
                newBtn.disabled = false;
                newBtn.innerHTML = originalText;
            }
        });
    }
}

async function handleSubirLogo(file) {
    const statusDiv = document.getElementById('logo-upload-status');
    const previewImg = document.getElementById('logo-preview');
    const hiddenInput = document.getElementById('config-logo');

    statusDiv.textContent = 'Subiendo logo...';
    statusDiv.className = 'text-xs mt-1 text-blue-600';

    const formData = new FormData();
    formData.append('logoFile', file);

    try {
        const resultado = await fetchAPI('/empresa/upload-logo', {
            method: 'POST',
            body: formData
        });

        // Actualizar UI
        previewImg.src = resultado.logoUrl;
        hiddenInput.value = resultado.logoUrl; // Actualizamos el input oculto

        statusDiv.textContent = '¡Logo actualizado! No olvides guardar cambios generales.';
        statusDiv.className = 'text-xs mt-1 text-green-600';

    } catch (error) {
        statusDiv.textContent = `Error al subir: ${error.message}`;
        statusDiv.className = 'text-xs mt-1 text-red-600';
    }
}

async function generarTextosHomeIA(tipo) {
    const btnId = tipo === 'seo' ? 'btn-generar-home-seo' : 'btn-generar-home-content';
    const btn = document.getElementById(btnId);

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generando...';
    }

    try {
        const endpoint = tipo === 'seo' ? '/website/generate-ai-home-seo' : '/website/generate-ai-home-content';

        // Recopilar contexto actual del formulario para enviarlo
        const contexto = {
            historiaEmpresa: document.getElementById('historiaEmpresa').value,
            slogan: document.getElementById('slogan').value,
            tipoAlojamientoPrincipal: document.getElementById('tipoAlojamientoPrincipal').value,
            enfoqueMarketing: document.getElementById('enfoqueMarketing').value,
            palabrasClaveAdicionales: document.getElementById('palabrasClaveAdicionales').value
        };

        const data = await fetchAPI(endpoint, {
            method: 'POST',
            body: { contexto } // Enviamos el contexto
        });

        if (tipo === 'seo') {
            document.getElementById('home-seo-title').value = clean(data.metaTitle);
            document.getElementById('home-seo-description').value = clean(data.metaDescription);
        } else {
            document.getElementById('home-h1').value = clean(data.h1);
            document.getElementById('home-intro').value = clean(data.introParagraph);
        }
    } catch (error) {
        alert(`Error generando textos con IA: ${error.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = tipo === 'seo' ? 'Generar SEO con IA' : 'Generar H1/Intro con IA';
        }
    }
}

async function guardarTextosHome() {
    const btn = document.getElementById('save-empresa-config-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Guardando...';
    }

    // 1. Payload para Website Settings
    const websitePayload = {
        general: {
            subdomain: document.getElementById('config-subdomain').value,
            domain: document.getElementById('config-domain').value
        },
        theme: {
            logoUrl: document.getElementById('config-logo').value,
            primaryColor: document.getElementById('config-color-primary').value,
            secondaryColor: document.getElementById('config-color-secondary').value,
            heroImageAlt: document.getElementById('upload-hero-alt-input').value,
            heroImageTitle: document.getElementById('upload-hero-title-input').value
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

    // 2. Payload para Datos de Empresa (Root)
    const empresaPayload = {
        slogan: document.getElementById('slogan').value,
        historiaEmpresa: document.getElementById('historiaEmpresa').value,
        tipoAlojamientoPrincipal: document.getElementById('tipoAlojamientoPrincipal').value,
        enfoqueMarketing: document.getElementById('enfoqueMarketing').value,
        palabrasClaveAdicionales: document.getElementById('palabrasClaveAdicionales').value
    };

    try {
        // Ejecutar ambas actualizaciones en paralelo
        await Promise.all([
            fetchAPI('/website/home-settings', { method: 'PUT', body: websitePayload }),
            fetchAPI('/empresa', { method: 'PUT', body: empresaPayload })
        ]);

        alert('Configuración general y datos de empresa guardados con éxito.');
    } catch (error) {
        alert(`Error al guardar: ${error.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Guardar Configuración General';
        }
    }
}

async function handleSubirHeroImage(imageBlob) {
    const statusEl = document.getElementById('upload-hero-status');
    statusEl.textContent = 'Subiendo...';

    const formData = new FormData();
    formData.append('heroImage', imageBlob, 'hero.jpg');
    formData.append('altText', document.getElementById('upload-hero-alt-input').value);
    formData.append('titleText', document.getElementById('upload-hero-title-input').value);

    try {
        const result = await fetchAPI('/website/upload-hero-image', { method: 'POST', body: formData });
        const previewContainer = document.getElementById('hero-preview-container');
        previewContainer.innerHTML = `<img src="${result['websiteSettings.theme.heroImageUrl']}" class="w-full h-32 object-cover rounded-md border bg-gray-100">`;
        statusEl.textContent = 'Imagen subida con éxito.';
        // Actualizar referencia local
        fullEmpresaData.websiteSettings = fullEmpresaData.websiteSettings || {};
        fullEmpresaData.websiteSettings.theme = fullEmpresaData.websiteSettings.theme || {};
        fullEmpresaData.websiteSettings.theme.heroImageUrl = result['websiteSettings.theme.heroImageUrl'];
        setupGeneralEvents();
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
    }
}