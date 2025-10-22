// frontend/src/views/configurarWebPublica.js
import { fetchAPI } from '../api.js';

let todasLasPropiedades = [];
let empresaInfo = {};
let propiedadSeleccionada = null;
let websiteDataPropiedad = { aiDescription: '', images: {}, cardImage: null };
let websiteSettingsEmpresa = { seo: {}, content: {}, theme: {}, general: {} };

// --- Funciones Auxiliares de Renderizado (SECCIÓN HOME - FALTANTES) ---

function renderizarConfigGeneral() {
    const container = document.getElementById('seccion-config-general');
    if (!container) return;
    const settings = websiteSettingsEmpresa.general || {};
    const theme = websiteSettingsEmpresa.theme || {};
    
    container.innerHTML = `
        <fieldset class="border p-4 rounded-md mb-4">
            <legend class="px-2 font-semibold text-gray-700">Configuración General</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                    <label for="config-subdomain" class="block text-sm font-medium">Subdominio</label>
                    <input type="text" id="config-subdomain" class="form-input mt-1" value="${settings.subdomain || ''}" placeholder="ej: miempresa">
                </div>
                <div>
                    <label for="config-domain" class="block text-sm font-medium">Dominio Personalizado</label>
                    <input type="text" id="config-domain" class="form-input mt-1" value="${settings.domain || ''}" placeholder="ej: miempresa.com">
                </div>
                <div>
                    <label for="config-logo" class="block text-sm font-medium">URL del Logo</label>
                    <input type="url" id="config-logo" class="form-input mt-1" value="${theme.logoUrl || ''}">
                </div>
                <div>
                    <label for="config-color-primary" class="block text-sm font-medium">Color Primario</label>
                    <input type="color" id="config-color-primary" class="form-input h-10 p-1 mt-1" value="${theme.primaryColor || '#000000'}">
                </div>
                <div>
                    <label for="config-color-secondary" class="block text-sm font-medium">Color Secundario</label>
                    <input type="color" id="config-color-secondary" class="form-input h-10 p-1 mt-1" value="${theme.secondaryColor || '#FFFFFF'}">
                </div>
            </div>
        </fieldset>
    `;
}

function renderizarSeccionTextosHome() {
    const container = document.getElementById('seccion-textos-home');
    if (!container) return;
    const seo = websiteSettingsEmpresa.seo || {};
    const content = websiteSettingsEmpresa.content || {};

    container.innerHTML = `
        <fieldset class="border p-4 rounded-md mb-4">
            <legend class="px-2 font-semibold text-gray-700">Textos (Página de Inicio)</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                    <label for="home-seo-title" class="block text-sm font-medium">Meta Título (SEO)</label>
                    <input type="text" id="home-seo-title" class="form-input mt-1" value="${seo.homeTitle || ''}">
                </div>
                <div>
                    <label for="home-seo-description" class="block text-sm font-medium">Meta Descripción (SEO)</label>
                    <input type="text" id="home-seo-description" class="form-input mt-1" value="${seo.homeDescription || ''}">
                </div>
                <div>
                    <label for="home-h1" class="block text-sm font-medium">Título Principal (H1)</label>
                    <input type="text" id="home-h1" class="form-input mt-1" value="${content.homeH1 || ''}">
                </div>
                <div class="md:col-span-2">
                    <label for="home-intro" class="block text-sm font-medium">Párrafo Introductorio</label>
                    <textarea id="home-intro" rows="3" class="form-input mt-1">${content.homeIntro || ''}</textarea>
                </div>
            </div>
            <div class="mt-4">
                <button id="btn-generar-home-seo" class="btn-secondary btn-sm mr-2">Generar SEO con IA</button>
                <button id="btn-generar-home-content" class="btn-secondary btn-sm">Generar H1/Intro con IA</button>
            </div>
        </fieldset>
    `;
}

function renderizarSeccionImagenPortada() {
    const container = document.getElementById('seccion-imagen-portada');
    if (!container) return;
    const theme = websiteSettingsEmpresa.theme || {};

    container.innerHTML = `
        <fieldset class="border p-4 rounded-md mb-4">
            <legend class="px-2 font-semibold text-gray-700">Imagen de Portada (Hero)</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 items-start">
                <div>
                    <label class="block text-sm font-medium">Subir/Reemplazar Imagen Portada</label>
                    <input type="file" id="upload-hero-image-input" accept="image/*" class="form-input-file mt-1">
                    <label class="block text-sm font-medium mt-2">Texto Alternativo (Alt)</label>
                    <input type="text" id="upload-hero-alt-input" class="form-input mt-1" placeholder="Descripción para SEO..." value="${theme.heroImageAlt || ''}">
                    <label class="block text-sm font-medium mt-2">Título (Title)</label>
                    <input type="text" id="upload-hero-title-input" class="form-input mt-1" placeholder="Título de la imagen..." value="${theme.heroImageTitle || ''}">
                    <button id="upload-hero-image-btn" class="btn-secondary btn-sm mt-3">Subir Imagen Portada</button>
                    <div id="upload-hero-status" class="text-xs mt-1"></div>
                </div>
                <div>
                    <p class="text-xs text-gray-600 mb-2 font-medium">Vista Previa Actual:</p>
                    ${theme.heroImageUrl ? 
                        `<img src="${theme.heroImageUrl}" alt="Vista previa portada" class="w-full h-32 object-cover rounded-md border bg-gray-100">` :
                        '<div class="w-full h-32 flex items-center justify-center bg-gray-100 text-gray-400 rounded-md border">Sin imagen</div>'
                    }
                </div>
            </div>
        </fieldset>
    `;
}

// --- Funciones Auxiliares de Renderizado (SECCIÓN PROPIEDAD - NUEVAS) ---

function renderizarSeccionImagenTarjeta() {
    const container = document.getElementById('seccion-imagen-tarjeta-propiedad');
    if (!container || !propiedadSeleccionada) return;

    const cardImage = websiteDataPropiedad.cardImage;
    const isListed = propiedadSeleccionada.googleHotelData?.isListed || false;
    let previewContent = '';

    if (cardImage && cardImage.storagePath) {
        previewContent = `
            <p class="text-xs text-green-600 mb-2 font-medium">Imagen de tarjeta actual:</p>
            <div class="relative w-48 border rounded-md overflow-hidden group">
                <img src="${cardImage.storagePath}" 
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/100x60.png?text=Error';"
                     alt="${cardImage.altText || 'Imagen Tarjeta'}" 
                     title="${cardImage.title || ''}" class="w-full h-32 object-cover">
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-opacity flex flex-col justify-end p-1 text-white text-[10px] opacity-0 group-hover:opacity-100">
                    <p class="truncate" title="Alt: ${cardImage.altText}">Alt: ${cardImage.altText}</p>
                </div>
            </div>
        `;
    } else if (isListed) {
        previewContent = `<p class="text-sm font-medium text-red-600 mb-2">⚠️ Esta propiedad está "Listada" y requiere una imagen principal. Por favor, sube una imagen.</p>`;
    } else {
        previewContent = `<p class="text-sm text-gray-500 mb-2">No se ha subido una imagen principal para la tarjeta.</p>`;
    }

    container.innerHTML = `
        <fieldset class="border p-4 rounded-md mb-4 border-indigo-500 border-2">
            <legend class="px-2 font-semibold text-indigo-700">Imagen Principal (Tarjeta/Home) - Obligatoria si está Listada</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start mt-2">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Subir/Reemplazar Imagen</label>
                    <input type="file" accept="image/*" id="subir-card-image-input" class="form-input-file mt-1">
                    <div id="upload-status-card-image" class="text-xs mt-1"></div>
                    <button type="button" id="upload-card-image-btn" class="btn-secondary btn-sm mt-2">Subir Imagen</button>
                </div>
                <div id="preview-card-image-container">
                    ${previewContent}
                </div>
            </div>
        </fieldset>
    `;

    document.getElementById('upload-card-image-btn').addEventListener('click', handleSubirCardImage);
}

function renderizarSeccionTextoPropiedad() {
    const container = document.getElementById('seccion-texto-propiedad');
    if (!container || !propiedadSeleccionada) return;

    container.innerHTML = `
        <fieldset class="border p-4 rounded-md mb-4">
            <legend class="px-2 font-semibold text-gray-700">Descripción Optimizada (IA)</legend>
            <p class="text-xs text-gray-500 mt-1 mb-3">Esta descripción se usará en la página de la propiedad. La IA la genera basándose en tu descripción manual.</p>
            <div class="space-y-2">
                <textarea id="ai-description-textarea" rows="8" class="form-input w-full">${websiteDataPropiedad.aiDescription || ''}</textarea>
                <div class="flex flex-wrap gap-2">
                    <button id="btn-generar-ai-desc" class="btn-secondary btn-sm">
                        <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707.707"></path></svg>
                        Generar con IA
                    </button>
                    <button id="btn-guardar-ai-desc" class="btn-primary btn-sm">Guardar Descripción</button>
                </div>
                <div id="save-ai-description-status" class="text-xs mt-1"></div>
            </div>
        </fieldset>
    `;

    document.getElementById('btn-generar-ai-desc').addEventListener('click', generarTextoDescripcionPropiedad);
    document.getElementById('btn-guardar-ai-desc').addEventListener('click', guardarTextoDescripcionPropiedad);
}

function renderizarGestorImagenes() {
    const container = document.getElementById('seccion-imagenes-propiedad');
    if (!container || !propiedadSeleccionada) return;

    if (!propiedadSeleccionada.componentes || propiedadSeleccionada.componentes.length === 0) {
        container.innerHTML = `<h3 class="text-lg font-semibold text-gray-800 mb-2">Imágenes Adicionales (Galería)</h3><p class="text-sm text-gray-500 p-4 border rounded-md bg-gray-50">Define 'Componentes Adicionales' en 'Gestionar Alojamientos' para subir más imágenes (ej: Dormitorio, Baño, Cocina).</p>`;
        return;
    }

    container.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Imágenes Adicionales (Galería)</h3>
        ${propiedadSeleccionada.componentes.map(componente => `
        <fieldset class="border p-4 rounded-md mb-4">
            <legend class="px-2 font-semibold text-gray-700">
                ${componente.nombre} (Tipo: ${componente.tipo})
            </legend>
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
    `).join('')}`;

    container.querySelectorAll('.subir-imagenes-input').forEach(input => {
        input.addEventListener('change', (e) => handleSubirImagenesPropiedad(e.target.dataset.componentId, e.target.files));
    });
    container.querySelectorAll('.eliminar-imagen-btn').forEach(button => {
        button.addEventListener('click', (e) => handleEliminarImagenPropiedad(e.currentTarget.dataset.componentId, e.currentTarget.dataset.imageId));
    });
}

function renderizarImagenesComponente(componentId) {
    const imagenes = websiteDataPropiedad.images?.[componentId] || [];
    if (imagenes.length === 0) {
        return '<p class="text-xs text-gray-500 col-span-full">No hay imágenes para este componente.</p>';
    }
    const getImageUrl = (storagePath) => storagePath || '';
    return imagenes.map(img => `
        <div class="relative border rounded-md overflow-hidden group">
            <img src="${getImageUrl(img.storagePath)}"
                 onerror="this.onerror=null; this.src='https://via.placeholder.com/100x60.png?text=Error';"
                 alt="${img.altText || 'Imagen de alojamiento'}"
                 title="${img.title || ''}" class="w-full h-24 object-cover">
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


// --- Funciones de Lógica y API (SECCIÓN HOME - FALTANTES) ---

async function generarTextosHomeIA(tipo) {
    const btnId = tipo === 'seo' ? 'btn-generar-home-seo' : 'btn-generar-home-content';
    const btn = document.getElementById(btnId);
    btn.disabled = true;
    btn.innerHTML = 'Generando...';

    try {
        const endpoint = tipo === 'seo' ? '/website-config/generate-ai-home-seo' : '/website-config/generate-ai-home-content';
        const data = await fetchAPI(endpoint, { method: 'POST' });

        if (tipo === 'seo') {
            document.getElementById('home-seo-title').value = data.homeTitle;
            document.getElementById('home-seo-description').value = data.homeDescription;
        } else {
            document.getElementById('home-h1').value = data.homeH1;
            document.getElementById('home-intro').value = data.homeIntro;
        }
    } catch (error) {
        alert(`Error generando textos con IA: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = tipo === 'seo' ? 'Generar SEO con IA' : 'Generar H1/Intro con IA';
    }
}

async function guardarTextosHome() {
    const btn = document.getElementById('save-empresa-config-btn');
    btn.disabled = true;
    btn.innerHTML = 'Guardando...';

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
        // Actualizar estado local
        websiteSettingsEmpresa.general = payload.general;
        websiteSettingsEmpresa.theme = { ...websiteSettingsEmpresa.theme, ...payload.theme };
        websiteSettingsEmpresa.content = payload.content;
        websiteSettingsEmpresa.seo = payload.seo;
        alert('Configuración general guardada con éxito.');
    } catch (error) {
        alert(`Error al guardar: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Configuración General';
    }
}

async function handleSubirHeroImage() {
    const input = document.getElementById('upload-hero-image-input');
    const file = input.files?.[0];
    if (!file) {
        alert('Selecciona una imagen primero.');
        return;
    }

    const btn = document.getElementById('upload-hero-image-btn');
    const statusEl = document.getElementById('upload-hero-status');
    btn.disabled = true;
    statusEl.textContent = 'Subiendo...';

    const formData = new FormData();
    formData.append('heroImage', file);
    formData.append('altText', document.getElementById('upload-hero-alt-input').value);
    formData.append('titleText', document.getElementById('upload-hero-title-input').value);

    try {
        const result = await fetchAPI('/website-config/upload-hero-image', { method: 'POST', body: formData });
        
        // Actualizar estado local y renderizar
        websiteSettingsEmpresa.theme.heroImageUrl = result.heroImageUrl;
        websiteSettingsEmpresa.theme.heroImageAlt = result.heroImageAlt;
        websiteSettingsEmpresa.theme.heroImageTitle = result.heroImageTitle;
        renderizarSeccionImagenPortada();
        statusEl.textContent = 'Imagen de portada subida con éxito.';

    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
    } finally {
        btn.disabled = false;
    }
}


// --- Funciones de Lógica y API (SECCIÓN PROPIEDAD - NUEVAS) ---

async function cargarDatosWebPropiedad(propiedadId) {
    if (!propiedadId) return;
    document.getElementById('seccion-imagen-tarjeta-propiedad').innerHTML = '<p class="text-sm text-gray-500">Cargando...</p>';
    document.getElementById('seccion-texto-propiedad').innerHTML = '<p class="text-sm text-gray-500">Cargando...</p>';
    document.getElementById('seccion-imagenes-propiedad').innerHTML = '';

    propiedadSeleccionada = todasLasPropiedades.find(p => p.id === propiedadId);
    
    try {
        const data = await fetchAPI(`/website-config/propiedad/${propiedadId}`);
        websiteDataPropiedad = {
            aiDescription: data.aiDescription || '',
            images: data.images || {},
            cardImage: data.cardImage || null
        };
    } catch (error) {
        console.error("Error cargando datos web de la propiedad:", error);
        websiteDataPropiedad = { aiDescription: '', images: {}, cardImage: null };
        document.getElementById('seccion-texto-propiedad').innerHTML = `<p class="text-red-500">Error al cargar datos.</p>`;
    }

    renderizarSeccionImagenTarjeta();
    renderizarSeccionTextoPropiedad();
    renderizarGestorImagenes();
}

async function generarTextoDescripcionPropiedad() {
    if (!propiedadSeleccionada) return;
    const btn = document.getElementById('btn-generar-ai-desc');
    const textarea = document.getElementById('ai-description-textarea');
    btn.disabled = true;
    btn.innerHTML = 'Generando...';
    try {
        const { texto } = await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/generate-ai-text`, { method: 'POST' });
        textarea.value = texto;
        websiteDataPropiedad.aiDescription = texto;
    } catch (error) {
        alert(`Error generando texto: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Generar con IA';
    }
}

async function guardarTextoDescripcionPropiedad() {
    if (!propiedadSeleccionada) return;

    const isListed = propiedadSeleccionada.googleHotelData?.isListed || false;
    const hasCardImage = websiteDataPropiedad.cardImage && websiteDataPropiedad.cardImage.storagePath;

    if (isListed && !hasCardImage) {
        alert('Error: No se puede guardar.\nEsta propiedad está marcada como "Listada" pero no tiene una "Imagen Principal (Tarjeta/Home)".\n\nPor favor, sube la imagen principal primero usando el botón "Subir Imagen" en la sección de arriba.');
        return;
    }

    const aiDescription = document.getElementById('ai-description-textarea')?.value;
    const statusEl = document.getElementById('save-ai-description-status');
    statusEl.textContent = 'Guardando...';
    statusEl.classList.remove('text-red-500');

    try {
        await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}`, {
            method: 'PUT',
            body: { aiDescription }
        });
        statusEl.textContent = 'Descripción guardada con éxito.';
        websiteDataPropiedad.aiDescription = aiDescription;
    } catch (error) {
        console.error('Error guardando descripción:', error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
        if (error.error === 'VALIDATION_ERROR') {
            alert(`Error del servidor: ${error.message}`);
        }
    }
}

async function handleSubirCardImage() {
    const input = document.getElementById('subir-card-image-input');
    const file = input.files?.[0];
    if (!propiedadSeleccionada || !file) {
        alert('Por favor, selecciona un archivo primero.');
        return;
    }

    const statusEl = document.getElementById('upload-status-card-image');
    statusEl.textContent = 'Subiendo, optimizando y generando IA...';
    statusEl.classList.remove('text-red-500', 'text-green-500');
    document.getElementById('upload-card-image-btn').disabled = true;

    const formData = new FormData();
    formData.append('cardImage', file);

    try {
        const result = await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/upload-card-image`, {
            method: 'POST',
            body: formData
        });

        websiteDataPropiedad.cardImage = result;
        
        statusEl.textContent = '¡Imagen subida con éxito!';
        statusEl.classList.add('text-green-500');
        renderizarSeccionImagenTarjeta();
        input.value = '';

    } catch (error) {
        console.error('Error subiendo imagen de tarjeta:', error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
    } finally {
        document.getElementById('upload-card-image-btn').disabled = false;
    }
}

async function handleSubirImagenesPropiedad(componentId, files) {
    if (!propiedadSeleccionada || !files.length) return;
    const statusEl = document.getElementById(`upload-status-${componentId}`);
    statusEl.textContent = `Subiendo ${files.length} imágenes...`;
    statusEl.classList.remove('text-red-500');
    const formData = new FormData();
    for (const file of files) {
        formData.append('images', file);
    }
    try {
        const resultados = await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/upload-image/${componentId}`, {
            method: 'POST',
            body: formData
        });
        if (!websiteDataPropiedad.images[componentId]) {
            websiteDataPropiedad.images[componentId] = [];
        }
        websiteDataPropiedad.images[componentId].push(...resultados);
        renderizarImagenesComponente(componentId);
        statusEl.textContent = 'Subida completada. Metadatos IA en proceso.';
    } catch (error) {
        console.error('Error subiendo imágenes:', error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
    }
}

async function handleEliminarImagenPropiedad(componentId, imageId) {
     if (!propiedadSeleccionada) return;
    if (!confirm('¿Estás seguro de que quieres eliminar esta imagen?')) return;
    try {
        await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/delete-image/${componentId}/${imageId}`, {
            method: 'DELETE'
        });
        if (websiteDataPropiedad.images[componentId]) {
            websiteDataPropiedad.images[componentId] = websiteDataPropiedad.images[componentId].filter(img => img.imageId !== imageId);
        }
        renderizarImagenesComponente(componentId);
    } catch (error) {
        alert(`Error al eliminar imagen: ${error.message}`);
    }
}


// --- Renderizado Principal y Lógica de Eventos ---

export async function render() {
    // HTML actualizado con el nuevo contenedor 'seccion-imagen-tarjeta-propiedad'
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-6">
            <h2 class="text-2xl font-semibold text-gray-900">Configurar Contenido Web Público</h2>
            
            <div id="seccion-config-general"></div>
            <div id="seccion-textos-home"></div>
            <div id="seccion-imagen-portada"></div>
            <div class="text-right border-t pt-4">
                <button id="save-empresa-config-btn" class="btn-primary btn-lg">Guardar Configuración General</button>
            </div>
            
            <div class="border-t pt-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Contenido por Alojamiento Específico</h3>
                 <div>
                    <label for="propiedad-select" class="block text-sm font-medium text-gray-700">Seleccionar Alojamiento</label>
                    <select id="propiedad-select" class="form-select mt-1">
                        <option value="">-- Elige un alojamiento --</option>
                    </select>
                </div>

                <div id="config-container-propiedad" class="hidden space-y-6 mt-4">
                    
                    <div id="seccion-imagen-tarjeta-propiedad">
                    </div>

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

    try {
        [empresaInfo, todasLasPropiedades] = await Promise.all([
            fetchAPI('/empresa'),
            fetchAPI('/propiedades')
        ]);
        const configWeb = await fetchAPI('/website-config/configuracion-web');
        
        websiteSettingsEmpresa.general = { subdomain: configWeb.subdomain || '', domain: configWeb.domain || '' };
        websiteSettingsEmpresa.theme = configWeb.theme || {};
        websiteSettingsEmpresa.content = configWeb.content || {};
        websiteSettingsEmpresa.seo = configWeb.seo || {};

        // *** LLAMADAS A FUNCIONES RESTAURADAS ***
        renderizarConfigGeneral();
        renderizarSeccionTextosHome();
        renderizarSeccionImagenPortada();

        propiedadSelect.innerHTML = '<option value="">-- Elige un alojamiento --</option>' +
            todasLasPropiedades
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

        // *** LISTENERS RESTAURADOS ***
        document.getElementById('btn-generar-home-seo').addEventListener('click', () => generarTextosHomeIA('seo'));
        document.getElementById('btn-generar-home-content').addEventListener('click', () => generarTextosHomeIA('content'));
        document.getElementById('save-empresa-config-btn').addEventListener('click', guardarTextosHome);
        document.getElementById('upload-hero-image-btn').addEventListener('click', handleSubirHeroImage);

    } catch (error) {
        console.error("Error cargando datos iniciales:", error);
        document.getElementById('seccion-config-general').innerHTML = `<p class="text-red-500">Error al cargar: ${error.message}</p>`;
    }

    propiedadSelect.addEventListener('change', async (e) => {
        const propiedadId = e.target.value;
        if (propiedadId) {
            configContainerPropiedad.classList.remove('hidden');
            await cargarDatosWebPropiedad(propiedadId); 
        } else {
            propiedadSeleccionada = null;
            websiteDataPropiedad = { aiDescription: '', images: {}, cardImage: null };
            configContainerPropiedad.classList.add('hidden');
            document.getElementById('seccion-imagen-tarjeta-propiedad').innerHTML = '';
            document.getElementById('seccion-texto-propiedad').innerHTML = '';
            document.getElementById('seccion-imagenes-propiedad').innerHTML = '';
        }
    });
}