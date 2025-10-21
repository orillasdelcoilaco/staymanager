// frontend/src/views/configurarWebPublica.js
import { fetchAPI } from '../api.js';

let todasLasPropiedades = [];
let empresaInfo = {}; // Para guardar los datos generales de la empresa
let propiedadSeleccionada = null; // Guardará el objeto completo de la propiedad seleccionada
let websiteDataPropiedad = { aiDescription: '', images: {} }; // Datos específicos de la propiedad
let websiteSettingsEmpresa = { seo: {}, content: {}, theme: {}, general: {} }; // Datos generales de la web

// --- Funciones Auxiliares de Renderizado ---

// Renderiza la sección de Textos SEO Generales (Página de Inicio)
function renderizarSeccionTextosHome() {
    const container = document.getElementById('seccion-textos-home');
    if (!container || !empresaInfo) return;

    const seo = websiteSettingsEmpresa.seo || {};
    const content = websiteSettingsEmpresa.content || {};

    container.innerHTML = `
        <fieldset class="border p-4 rounded-md">
            <legend class="px-2 font-semibold text-gray-700">Textos SEO y Contenido - Página de Inicio</legend>
            <div class="mt-4 space-y-4">
                <p class="text-xs text-gray-500">
                    Información base usada por la IA (desde Configuración Empresa):<br>
                    <strong>Ubicación:</strong> ${empresaInfo.ubicacionTexto || 'No definida'} |
                    <strong>Tipo Aloj.:</strong> ${empresaInfo.tipoAlojamientoPrincipal || 'No definido'} |
                    <strong>Enfoque:</strong> ${empresaInfo.enfoqueMarketing || 'No definido'} |
                    <strong>Keywords:</strong> ${empresaInfo.palabrasClaveAdicionales || 'Ninguna'}
                </p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <button id="btn-generar-home-seo" class="btn-secondary text-sm w-full">✨ Generar Meta Título y Descripción</button>
                    </div>
                    <div>
                         <button id="btn-generar-home-content" class="btn-secondary text-sm w-full">✨ Generar Título H1 y Párrafo Intro</button>
                    </div>
                </div>
                 <div id="ia-home-status" class="text-sm text-gray-500 text-center"></div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label for="seo-home-title" class="block text-sm font-medium text-gray-700">SEO Title (Título de la pestaña)</label>
                        <input type="text" id="seo-home-title" class="form-input mt-1" value="${seo.homeTitle || ''}" placeholder="Ej: Cabañas en Pucón | Reserva Directa">
                    </div>
                    <div>
                        <label for="home-h1" class="block text-sm font-medium text-gray-700">Título Principal (H1) del Home</label>
                        <input type="text" id="home-h1" class="form-input mt-1" value="${content.homeH1 || ''}" placeholder="Ej: Cabañas con Tinaja en Pucón">
                    </div>
                    <div class="md:col-span-2">
                        <label for="seo-home-description" class="block text-sm font-medium text-gray-700">SEO Description (Para Google)</label>
                        <textarea id="seo-home-description" rows="3" class="form-input mt-1" placeholder="Ej: Descubre las mejores cabañas...">${seo.homeDescription || ''}</textarea>
                    </div>
                    <div class="md:col-span-2">
                        <label for="home-intro" class="block text-sm font-medium text-gray-700">Texto Introductorio del Home (Bajo el H1)</label>
                        <textarea id="home-intro" rows="4" class="form-input mt-1" placeholder="Ej: Bienvenido a nuestro refugio...">${content.homeIntro || ''}</textarea>
                    </div>
                </div>
            </div>
        </fieldset>
    `;
}

// Renderiza la sección de Imagen de Portada (Hero Image)
function renderizarSeccionImagenPortada() {
    const container = document.getElementById('seccion-imagen-portada');
    if (!container || !empresaInfo) return;

    const theme = websiteSettingsEmpresa.theme || {};
    const heroImageUrl = theme.heroImageUrl || '';
    const heroImageAlt = theme.heroImageAlt || '';
    const heroImageTitle = theme.heroImageTitle || '';

    container.innerHTML = `
        <fieldset class="border p-4 rounded-md">
            <legend class="px-2 font-semibold text-gray-700">Imagen de Portada (Página de Inicio)</legend>
            <div class="mt-4 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div>
                        <label for="heroImageFile" class="block text-sm font-medium text-gray-700">Subir Nueva Imagen de Portada</label>
                        <input type="file" id="heroImageFile" accept="image/*" class="form-input-file mt-1">
                        <p class="text-xs text-gray-500 mt-1">La imagen se optimizará a 1920x1080px (WebP).</p>
                        
                        <label for="hero-image-alt" class="block text-sm font-medium text-gray-700 mt-2">Texto Alternativo (Alt)</label>
                        <input type="text" id="hero-image-alt" class="form-input mt-1" value="${heroImageAlt}" placeholder="Descripción para SEO y accesibilidad">
                        
                        <label for="hero-image-title" class="block text-sm font-medium text-gray-700 mt-2">Texto de Título (Tooltip)</label>
                        <input type="text" id="hero-image-title" class="form-input mt-1" value="${heroImageTitle}" placeholder="Texto corto al pasar el mouse">
                        
                        <button id="upload-hero-image-btn" class="btn-secondary text-sm mt-3 w-full">Subir y Guardar Imagen</button>
                        <div id="hero-upload-status" class="text-xs mt-1"></div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Imagen Actual</label>
                        ${heroImageUrl
                            ? `<img id="hero-image-preview" src="${heroImageUrl}" alt="${heroImageAlt}" title="${heroImageTitle}" class="mt-1 w-full h-auto max-h-48 object-cover rounded border">`
                            : '<p id="hero-image-preview" class="text-sm text-gray-500 mt-1">No hay imagen de portada.</p>'
                        }
                    </div>
                </div>
            </div>
        </fieldset>
    `;
}

// Renderiza la sección de Configuración General (Dominio, etc.)
function renderizarConfigGeneral() {
    const container = document.getElementById('seccion-config-general');
    if (!container) return;

    const general = websiteSettingsEmpresa.general || {};
    const theme = websiteSettingsEmpresa.theme || {};
    
    container.innerHTML = `
        <fieldset class="border p-4 rounded-md">
            <legend class="px-2 font-semibold text-gray-700">Configuración General y Tema</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                    <label for="subdomain-input" class="block text-sm font-medium text-gray-700">Subdominio (Ej: prueba1)</label>
                    <input type="text" id="subdomain-input" class="form-input mt-1" value="${general.subdomain || ''}" placeholder="ej: miempresa">
                </div>
                <div>
                    <label for="domain-input" class="block text-sm font-medium text-gray-700">Dominio Personalizado (Ej: miempresa.com)</label>
                    <input type="text" id="domain-input" class="form-input mt-1" value="${general.domain || ''}" placeholder="ej: miempresa.com">
                </div>
                <div>
                    <label for="logo-url-input" class="block text-sm font-medium text-gray-700">URL del Logo (opcional)</label>
                    <input type="url" id="logo-url-input" class="form-input mt-1" value="${theme.logoUrl || ''}" placeholder="https://ejemplo.com/mi-logo.png">
                </div>
                 <div>
                    <label for="theme-primary-color" class="block text-sm font-medium text-gray-700">Color Primario (Botones, Links)</label>
                    <input type="color" id="theme-primary-color" value="${theme.primaryColor || '#4f46e5'}" class="form-input mt-1 h-10 w-full">
                </div>
                <div>
                    <label for="theme-secondary-color" class="block text-sm font-medium text-gray-700">Color Secundario (Acentos)</label>
                    <input type="color" id="theme-secondary-color" value="${theme.secondaryColor || '#f87171'}" class="form-input mt-1 h-10 w-full">
                </div>
            </div>
        </fieldset>
    `;
}


// Renderiza la sección de Texto SEO para la Propiedad Seleccionada
function renderizarSeccionTextoPropiedad() {
    const container = document.getElementById('seccion-texto-propiedad');
    if (!container || !propiedadSeleccionada) return;

    container.innerHTML = `
        <fieldset class="border p-4 rounded-md">
            <legend class="px-2 font-semibold text-gray-700">Descripción SEO - ${propiedadSeleccionada.nombre}</legend>
            <div class="mt-4 space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-500">Descripción Manual Base (desde Gestionar Alojamientos)</label>
                    <p class="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-md border min-h-[60px]">
                        ${propiedadSeleccionada.descripcion || 'No hay descripción base.'}
                    </p>
                </div>
                <div>
                    <button id="btn-generar-texto-propiedad" class="btn-secondary text-sm">✨ Generar/Regenerar Descripción Optimizada</button>
                    <span id="ia-propiedad-status" class="ml-2 text-sm text-gray-500"></span>
                </div>
                <div id="propiedad-desc-input-container">
                    <label for="aiDescriptionPropiedad" class="block text-sm font-medium text-gray-700">Descripción Optimizada (Editable)</label>
                    <textarea id="aiDescriptionPropiedad" name="aiDescriptionPropiedad" rows="8" class="form-input mt-1">${websiteDataPropiedad.aiDescription || ''}</textarea>
                     <div class="text-right mt-2">
                        <button id="btn-guardar-texto-propiedad" class="btn-primary">Guardar Descripción</button>
                    </div>
                </div>
            </div>
        </fieldset>
    `;

    // Añadir listeners
    document.getElementById('btn-generar-texto-propiedad')?.addEventListener('click', generarTextoDescripcionPropiedad);
    document.getElementById('btn-guardar-texto-propiedad')?.addEventListener('click', guardarTextoDescripcionPropiedad);
}


// Renderiza la sección de Gestión de Imágenes (por componentes)
function renderizarGestorImagenes() {
    const container = document.getElementById('seccion-imagenes-propiedad');
    if (!container || !propiedadSeleccionada || !propiedadSeleccionada.componentes || propiedadSeleccionada.componentes.length === 0) {
        if(container) container.innerHTML = `<p class="text-sm text-gray-500 p-4 border rounded-md">Define los 'Componentes' de este alojamiento en 'Gestionar Alojamientos' para poder subir imágenes.</p>`;
        return;
    }

    container.innerHTML = '<h3 class="text-lg font-semibold text-gray-800 mb-2">Imágenes por Componente</h3>' +
        propiedadSeleccionada.componentes.map(componente => `
        <fieldset class="border p-4 rounded-md mb-4">
            <legend class="px-2 font-semibold text-gray-700">${componente.nombre} (Tipo: ${componente.tipo})</legend>
            <div class="mt-4 space-y-3">
                <div id="galeria-${componente.id}" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    ${renderizarImagenesComponente(componente.id)}
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Subir Nuevas Imágenes para ${componente.nombre}</label>
                    <input type="file" multiple accept="image/*" data-component-id="${componente.id}" class="subir-imagenes-input form-input-file mt-1">
                    <div id="upload-status-${componente.id}" class="text-xs mt-1"></div>
                </div>
            </div>
        </fieldset>
    `).join('');

    container.querySelectorAll('.subir-imagenes-input').forEach(input => {
        input.addEventListener('change', (e) => handleSubirImagenesPropiedad(e.target.dataset.componentId, e.target.files));
    });
    container.querySelectorAll('.eliminar-imagen-btn').forEach(button => {
        button.addEventListener('click', (e) => handleEliminarImagenPropiedad(e.currentTarget.dataset.componentId, e.currentTarget.dataset.imageId));
    });
}


// Renderiza las imágenes de un componente específico (sin cambios)
function renderizarImagenesComponente(componentId) {
    const imagenes = websiteDataPropiedad.images?.[componentId] || [];
    if (imagenes.length === 0) {
        return '<p class="text-xs text-gray-500 col-span-full">No hay imágenes para este componente.</p>';
    }
    const getImageUrl = (storagePath) => storagePath || '';

    return imagenes.map(img => `
        <div class="relative border rounded-md overflow-hidden group">
            <img src="${getImageUrl(img.storagePath)}" alt="${img.altText || 'Imagen de alojamiento'}" title="${img.title || ''}" class="w-full h-24 object-cover">
             <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-opacity flex flex-col justify-between p-1 text-white text-[10px] opacity-0 group-hover:opacity-100">
                <button data-component-id="${componentId}" data-image-id="${img.imageId}" class="eliminar-imagen-btn absolute top-1 right-1 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center text-white font-bold leading-none p-0 cursor-pointer">&times;</button>
                <div class="bg-black bg-opacity-50 p-0.5 rounded-sm overflow-hidden">
                    <p class="truncate" title="Alt: ${img.altText || ''}">Alt: ${img.altText || '(no generado)'}</p>
                    ${img.title ? `<p class="truncate" title="Title: ${img.title}">Title: ${img.title}</p>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}


// --- Funciones de Lógica y API ---

// Carga los datos web de la propiedad Y los datos generales de la empresa
async function cargarDatosWebPropiedad(propiedadId) {
    const configContainer = document.getElementById('config-container-propiedad');
    const textoPropiedadContainer = document.getElementById('seccion-texto-propiedad');
    const imagenesPropiedadContainer = document.getElementById('seccion-imagenes-propiedad');

    if (!configContainer || !textoPropiedadContainer || !imagenesPropiedadContainer) return;

    textoPropiedadContainer.innerHTML = '<p class="text-sm text-gray-500">Cargando datos de la propiedad...</p>';
    imagenesPropiedadContainer.innerHTML = '';
    configContainer.classList.remove('hidden');

    try {
        propiedadSeleccionada = todasLasPropiedades.find(p => p.id === propiedadId);
        if (!propiedadSeleccionada) throw new Error('Propiedad no encontrada localmente.');

        // Obtener los datos más frescos desde la API por si acaso
        const websiteData = await fetchAPI(`/website-config/propiedad/${propiedadId}`);
        websiteDataPropiedad = websiteData || { aiDescription: '', images: {} };
        if (!websiteDataPropiedad.images) websiteDataPropiedad.images = {};
        
        // Actualizar la lista local
        propiedadSeleccionada.websiteData = websiteDataPropiedad;

        renderizarSeccionTextoPropiedad();
        renderizarGestorImagenes();

    } catch (error) {
        console.error("Error al cargar datos web de la propiedad:", error);
        textoPropiedadContainer.innerHTML = `<p class="text-red-500">Error al cargar datos: ${error.message}</p>`;
    }
}

// *** RESTAURADO: Llama a la API para generar textos SEO para Home ***
async function generarTextosHomeIA(tipo) { // tipo puede ser 'seo' o 'content'
    const btnSeo = document.getElementById('btn-generar-home-seo');
    const btnContent = document.getElementById('btn-generar-home-content');
    const statusSpan = document.getElementById('ia-home-status');

    btnSeo.disabled = true;
    btnContent.disabled = true;
    statusSpan.textContent = `Generando textos ${tipo}...`;

    try {
        const endpoint = tipo === 'seo' ? '/generate-ai-home-seo' : '/generate-ai-home-content';
        const resultado = await fetchAPI(`/website-config${endpoint}`, { method: 'POST' });

        if (tipo === 'seo') {
            document.getElementById('seo-home-title').value = resultado.metaTitle;
            document.getElementById('seo-home-description').value = resultado.metaDescription;
        } else {
            document.getElementById('home-h1').value = resultado.h1;
            document.getElementById('home-intro').value = resultado.introParagraph;
        }
        statusSpan.textContent = `Textos ${tipo} generados. Revisa y guarda.`;

    } catch (error) {
        statusSpan.textContent = `Error: ${error.message}`;
    } finally {
        btnSeo.disabled = false;
        btnContent.disabled = false;
    }
}

// *** RESTAURADO: Guarda los textos SEO y de contenido para Home ***
async function guardarTextosHome() {
    const btn = document.getElementById('save-empresa-config-btn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const payload = {
            general: {
                subdomain: document.getElementById('subdomain-input').value.trim(),
                domain: document.getElementById('domain-input').value.trim()
            },
            theme: {
                logoUrl: document.getElementById('logo-url-input').value.trim(),
                primaryColor: document.getElementById('theme-primary-color').value,
                secondaryColor: document.getElementById('theme-secondary-color').value
            },
            content: {
                homeH1: document.getElementById('home-h1').value.trim(),
                homeIntro: document.getElementById('home-intro').value.trim()
            },
            seo: {
                homeTitle: document.getElementById('seo-home-title').value.trim(),
                homeDescription: document.getElementById('seo-home-description').value.trim()
            }
        };

        await fetchAPI('/website-config/home-settings', { method: 'PUT', body: payload });

        // Actualizar estado local general
        websiteSettingsEmpresa.general = payload.general;
        websiteSettingsEmpresa.theme = { ...websiteSettingsEmpresa.theme, ...payload.theme };
        websiteSettingsEmpresa.content = payload.content;
        websiteSettingsEmpresa.seo = payload.seo;

        alert('Configuración de la empresa guardada.');
    } catch (error) {
        alert(`Error al guardar: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Configuración de la Empresa';
    }
}

// *** RESTAURADO: Sube la imagen de portada (Hero Image) ***
async function handleSubirHeroImage() {
    const fileInput = document.getElementById('heroImageFile');
    const file = fileInput.files[0];
    if (!file) return;

    const statusDiv = document.getElementById('hero-upload-status');
    const btn = document.getElementById('upload-hero-image-btn');
    statusDiv.textContent = 'Subiendo imagen...';
    statusDiv.className = 'text-xs mt-1 text-blue-600';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('heroImage', file);
    formData.append('altText', document.getElementById('hero-image-alt').value);
    formData.append('titleText', document.getElementById('hero-image-title').value);

    try {
        const resultado = await fetchAPI('/website-config/upload-hero-image', {
            method: 'POST',
            body: formData
        });

        // Actualizar estado local general
        if (!websiteSettingsEmpresa.theme) websiteSettingsEmpresa.theme = {};
        websiteSettingsEmpresa.theme.heroImageUrl = resultado.imageUrl;
        websiteSettingsEmpresa.theme.heroImageAlt = resultado.altText;
        websiteSettingsEmpresa.theme.heroImageTitle = resultado.titleText;

        statusDiv.textContent = '¡Imagen de portada subida!';
        statusDiv.className = 'text-xs mt-1 text-green-600';
        
        // Actualizar la UI
        const preview = document.getElementById('hero-image-preview');
        if (preview.tagName === 'P') { // Si era el placeholder
            const newImg = document.createElement('img');
            newImg.id = 'hero-image-preview';
            newImg.src = resultado.imageUrl;
            newImg.alt = resultado.altText;
            newImg.title = resultado.titleText;
            newImg.className = 'mt-1 w-full h-auto max-h-48 object-cover rounded border';
            preview.replaceWith(newImg);
        } else {
            preview.src = resultado.imageUrl;
            preview.alt = resultado.altText;
            preview.title = resultado.titleText;
        }

    } catch (error) {
        statusDiv.textContent = `Error al subir: ${error.message}`;
        statusDiv.className = 'text-xs mt-1 text-red-600';
    } finally {
        btn.disabled = false;
        fileInput.value = '';
    }
}


// Llama a la API para generar la descripción SEO de la PROPIEDAD
async function generarTextoDescripcionPropiedad() {
    if (!propiedadSeleccionada) return;

    const btn = document.getElementById('btn-generar-texto-propiedad');
    const statusSpan = document.getElementById('ia-propiedad-status');
    btn.disabled = true;
    statusSpan.textContent = 'Generando descripción...';

    try {
        const resultado = await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/generate-ai-text`, {
            method: 'POST'
        });
        document.getElementById('aiDescriptionPropiedad').value = resultado.texto;
        statusSpan.textContent = 'Descripción generada. Revisa y guarda.';
    } catch (error) {
        statusSpan.textContent = `Error: ${error.message}`;
    } finally {
        btn.disabled = false;
    }
}

// Guarda la descripción SEO editada de la PROPIEDAD
async function guardarTextoDescripcionPropiedad() {
    if (!propiedadSeleccionada) return;

    const btn = document.getElementById('btn-guardar-texto-propiedad');
    const statusSpan = document.getElementById('ia-propiedad-status');
    const texto = document.getElementById('aiDescriptionPropiedad').value;

    btn.disabled = true;
    statusSpan.textContent = 'Guardando descripción...';

    try {
        const payload = { aiDescription: texto };
        await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}`, {
            method: 'PUT',
            body: payload
        });

        websiteDataPropiedad.aiDescription = texto;
        statusSpan.textContent = 'Descripción guardada con éxito.';

        const index = todasLasPropiedades.findIndex(p => p.id === propiedadSeleccionada.id);
        if (index !== -1) {
            if (!todasLasPropiedades[index].websiteData) todasLasPropiedades[index].websiteData = { images: {} };
            todasLasPropiedades[index].websiteData.aiDescription = texto;
        }

    } catch (error) {
        statusSpan.textContent = `Error al guardar: ${error.message}`;
    } finally {
        btn.disabled = false;
    }
}

// Sube imágenes para un componente específico de la PROPIEDAD
async function handleSubirImagenesPropiedad(componentId, files) {
    if (!propiedadSeleccionada || files.length === 0) return;

    const statusDiv = document.getElementById(`upload-status-${componentId}`);
    statusDiv.textContent = `Subiendo ${files.length} imágen(es)...`;
    statusDiv.className = 'text-xs mt-1 text-blue-600';

    const formData = new FormData();
    for (const file of files) formData.append('images', file);

    try {
        const resultado = await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/upload-image/${componentId}`, {
            method: 'POST',
            body: formData
        });

        if (!websiteDataPropiedad.images) websiteDataPropiedad.images = {};
        if (!websiteDataPropiedad.images[componentId]) websiteDataPropiedad.images[componentId] = [];
        websiteDataPropiedad.images[componentId].push(...resultado);

        const index = todasLasPropiedades.findIndex(p => p.id === propiedadSeleccionada.id);
         if (index !== -1) {
            todasLasPropiedades[index].websiteData = websiteDataPropiedad;
        }

        statusDiv.textContent = `¡${files.length} imágen(es) subida(s)!`;
        statusDiv.className = 'text-xs mt-1 text-green-600';
        renderizarGestorImagenes();
    } catch (error) {
        statusDiv.textContent = `Error al subir: ${error.message}`;
        statusDiv.className = 'text-xs mt-1 text-red-600';
    } finally {
        const inputFile = document.querySelector(`.subir-imagenes-input[data-component-id="${componentId}"]`);
        if (inputFile) inputFile.value = '';
    }
}

// Elimina una imagen específica de la PROPIEDAD
async function handleEliminarImagenPropiedad(componentId, imageId) {
    if (!propiedadSeleccionada || !confirm('¿Estás seguro de eliminar esta imagen?')) return;

    const button = document.querySelector(`.eliminar-imagen-btn[data-image-id="${imageId}"]`);
    if(button) button.disabled = true;

    try {
        await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/delete-image/${componentId}/${imageId}`, {
            method: 'DELETE'
        });

        if (websiteDataPropiedad.images && websiteDataPropiedad.images[componentId]) {
            websiteDataPropiedad.images[componentId] = websiteDataPropiedad.images[componentId].filter(img => img.imageId !== imageId);
        }

         const index = todasLasPropiedades.findIndex(p => p.id === propiedadSeleccionada.id);
         if (index !== -1) {
            todasLasPropiedades[index].websiteData = websiteDataPropiedad;
        }

        renderizarGestorImagenes();
    } catch (error) {
        alert(`Error al eliminar imagen: ${error.message}`);
         if(button) button.disabled = false;
    }
}


// --- Renderizado Principal y Lógica de Eventos ---

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-6">
            <h2 class="text-2xl font-semibold text-gray-900">Configurar Contenido Web Público</h2>
            
            <div id="seccion-config-general">
                </div>
            <div id="seccion-textos-home">
                </div>
            <div id="seccion-imagen-portada">
                 </div>
            <div class="text-right border-t pt-4">
                <button id="save-empresa-config-btn" class="btn-primary btn-lg">Guardar Configuración General</button>
            </div>
            <div class="border-t pt-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">Contenido por Alojamiento Específico</h3>
                 <div>
                    <label for="propiedad-select" class="block text-sm font-medium text-gray-700">Seleccionar Alojamiento</label>
                    <select id="propiedad-select" class="form-select mt-1">
                        <option value="">-- Elige un alojamiento --</option>
                    </select>
                </div>

                <div id="config-container-propiedad" class="hidden space-y-6 mt-4">
                    <div id="seccion-texto-propiedad">
                        </div>
                    <div id="seccion-imagenes-propiedad">
                        </div>
                </div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    const propiedadSelect = document.getElementById('propiedad-select');
    const configContainerPropiedad = document.getElementById('config-container-propiedad');

    // Cargar datos iniciales (empresa y propiedades)
    try {
        [empresaInfo, todasLasPropiedades] = await Promise.all([
            fetchAPI('/empresa'),
            fetchAPI('/propiedades')
        ]);

        // Cargar datos de configuración web
        const configWeb = await fetchAPI('/website-config/configuracion-web');
        websiteSettingsEmpresa.general = {
            subdomain: configWeb.subdomain || '',
            domain: configWeb.domain || ''
        };
        websiteSettingsEmpresa.theme = configWeb.theme || {};
        websiteSettingsEmpresa.content = configWeb.content || {};
        websiteSettingsEmpresa.seo = configWeb.seo || {};

        // Renderizar secciones de Home Page ahora que tenemos empresaInfo
        renderizarConfigGeneral();
        renderizarSeccionTextosHome();
        renderizarSeccionImagenPortada();

        // Poblar selector de propiedades
        propiedadSelect.innerHTML = '<option value="">-- Elige un alojamiento --</option>' +
            todasLasPropiedades.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
            
        // *** RESTAURADO: Listeners para el Home ***
        document.getElementById('btn-generar-home-seo').addEventListener('click', () => generarTextosHomeIA('seo'));
        document.getElementById('btn-generar-home-content').addEventListener('click', () => generarTextosHomeIA('content'));
        document.getElementById('save-empresa-config-btn').addEventListener('click', guardarTextosHome);
        document.getElementById('upload-hero-image-btn').addEventListener('click', handleSubirHeroImage);
        // *** FIN RESTAURADO ***

    } catch (error) {
        console.error("Error cargando datos iniciales:", error);
        // Mostrar error en alguna parte de la UI si es necesario
    }

    // Listener para cuando se selecciona una propiedad
    propiedadSelect.addEventListener('change', async (e) => {
        const propiedadId = e.target.value;
        if (propiedadId) {
            configContainerPropiedad.classList.remove('hidden');
            await cargarDatosWebPropiedad(propiedadId); // Carga datos específicos de la prop
        } else {
            propiedadSeleccionada = null;
            websiteDataPropiedad = { aiDescription: '', images: {} };
            configContainerPropiedad.classList.add('hidden');
            document.getElementById('seccion-texto-propiedad').innerHTML = '';
            document.getElementById('seccion-imagenes-propiedad').innerHTML = '';
        }
    });
}