// frontend/src/views/configurarWebPublica.js
import { fetchAPI } from '../api.js';

let todasLasPropiedades = [];
let empresaInfo = {}; // Para guardar los datos generales de la empresa
let propiedadSeleccionada = null; // Guardará el objeto completo de la propiedad seleccionada
let websiteDataPropiedad = { aiDescription: '', images: {} }; // Datos específicos de la propiedad
let websiteSettingsEmpresa = { seo: {}, content: {}, theme: {} }; // Datos generales de la web

// --- Funciones Auxiliares de Renderizado ---

// Renderiza la sección de Textos SEO Generales (Página de Inicio)
function renderizarSeccionTextosHome() {
    const container = document.getElementById('seccion-textos-home');
    if (!container || !empresaInfo) return;

    // Extraer datos guardados o usar placeholders
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

                <div id="home-seo-inputs" class="space-y-3 ${ (seo.homeTitle || seo.homeDescription) ? '' : 'hidden' }">
                     <div>
                        <label for="homeMetaTitle" class="block text-sm font-medium text-gray-700">Meta Título (Home)</label>
                        <input type="text" id="homeMetaTitle" name="homeMetaTitle" class="form-input mt-1" value="${seo.homeTitle || ''}" maxlength="60">
                        <p class="text-xs text-gray-500">Máximo 60 caracteres. Se muestra en la pestaña del navegador y resultados de Google.</p>
                    </div>
                     <div>
                        <label for="homeMetaDescription" class="block text-sm font-medium text-gray-700">Meta Descripción (Home)</label>
                        <textarea id="homeMetaDescription" name="homeMetaDescription" rows="3" class="form-input mt-1" maxlength="155">${seo.homeDescription || ''}</textarea>
                        <p class="text-xs text-gray-500">Máximo 155 caracteres. Se muestra bajo el título en los resultados de Google.</p>
                    </div>
                </div>

                <div id="home-content-inputs" class="space-y-3 ${ (content.homeH1 || content.homeIntro) ? '' : 'hidden' }">
                    <div>
                        <label for="homeH1" class="block text-sm font-medium text-gray-700">Título Principal H1 (Home)</label>
                        <input type="text" id="homeH1" name="homeH1" class="form-input mt-1" value="${content.homeH1 || ''}" maxlength="70">
                         <p class="text-xs text-gray-500">Máximo 70 caracteres. El título más importante visible en la página.</p>
                    </div>
                    <div>
                        <label for="homeIntro" class="block text-sm font-medium text-gray-700">Párrafo Introductorio (Home)</label>
                        <textarea id="homeIntro" name="homeIntro" rows="4" class="form-input mt-1">${content.homeIntro || ''}</textarea>
                    </div>
                </div>

                <div class="text-right ${ (seo.homeTitle || content.homeH1) ? '' : 'hidden' }">
                    <button id="btn-guardar-textos-home" class="btn-primary">Guardar Textos de Inicio</button>
                </div>
            </div>
        </fieldset>
    `;

    // Añadir listeners a los nuevos botones
    document.getElementById('btn-generar-home-seo')?.addEventListener('click', () => generarTextosHomeIA('seo'));
    document.getElementById('btn-generar-home-content')?.addEventListener('click', () => generarTextosHomeIA('content'));
    document.getElementById('btn-guardar-textos-home')?.addEventListener('click', guardarTextosHome);
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
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                        <label for="heroImageFile" class="block text-sm font-medium text-gray-700">Subir Nueva Imagen de Portada</label>
                        <input type="file" id="heroImageFile" accept="image/*" class="form-input-file mt-1">
                        <div id="hero-upload-status" class="text-xs mt-1"></div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Imagen Actual</label>
                        ${heroImageUrl
                            ? `<img src="${heroImageUrl}" alt="${heroImageAlt}" title="${heroImageTitle}" class="mt-1 max-h-24 w-auto rounded border">`
                            : '<p class="text-sm text-gray-500 mt-1">No hay imagen de portada.</p>'
                        }
                    </div>
                </div>
                 ${heroImageUrl ? `<p class="text-xs text-gray-500"><strong>Alt Text:</strong> ${heroImageAlt}<br><strong>Title:</strong> ${heroImageTitle}</p>` : ''}
            </div>
        </fieldset>
    `;

    // Listener para subida de imagen
    document.getElementById('heroImageFile')?.addEventListener('change', (e) => handleSubirHeroImage(e.target.files[0]));
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
                <div id="propiedad-desc-input-container" class="${websiteDataPropiedad.aiDescription ? '' : 'hidden'}">
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
        container.innerHTML = `<p class="text-sm text-gray-500 p-4 border rounded-md">Define los 'Componentes' de este alojamiento en 'Gestionar Alojamientos' para poder subir imágenes.</p>`;
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

    // Añadir listeners generales para subida y eliminación después de actualizar el innerHTML
    container.querySelectorAll('.subir-imagenes-input').forEach(input => {
        input.addEventListener('change', (e) => handleSubirImagenesPropiedad(e.target.dataset.componentId, e.target.files));
    });
    // Volver a añadir listeners a los botones de eliminar imagen CADA VEZ que se renderiza
    container.querySelectorAll('.eliminar-imagen-btn').forEach(button => {
        button.replaceWith(button.cloneNode(true));
    });
    // Añadir el listener a los botones clonados
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
    const configContainer = document.getElementById('config-container');
    const textoPropiedadContainer = document.getElementById('seccion-texto-propiedad');
    const imagenesPropiedadContainer = document.getElementById('seccion-imagenes-propiedad');

    // Mostrar estado de carga
    textoPropiedadContainer.innerHTML = '<p class="text-sm text-gray-500">Cargando datos de la propiedad...</p>';
    imagenesPropiedadContainer.innerHTML = '';
    configContainer.classList.remove('hidden'); // Mostrar contenedor general

    try {
        // Cargar datos de la propiedad específica
        propiedadSeleccionada = todasLasPropiedades.find(p => p.id === propiedadId);
        if (!propiedadSeleccionada) throw new Error('Propiedad no encontrada localmente.');

        // Inicializar websiteDataPropiedad
        websiteDataPropiedad = propiedadSeleccionada.websiteData || { aiDescription: '', images: {} };
        if (!websiteDataPropiedad.images) websiteDataPropiedad.images = {};

        // Renderizar secciones específicas de la propiedad
        renderizarSeccionTextoPropiedad();
        renderizarGestorImagenes();

    } catch (error) {
        console.error("Error al cargar datos web de la propiedad:", error);
        textoPropiedadContainer.innerHTML = `<p class="text-red-500">Error al cargar datos de la propiedad: ${error.message}</p>`;
    }
}

// Llama a la API para generar textos SEO para Home
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
            document.getElementById('homeMetaTitle').value = resultado.metaTitle;
            document.getElementById('homeMetaDescription').value = resultado.metaDescription;
            document.getElementById('home-seo-inputs').classList.remove('hidden');
        } else {
            document.getElementById('homeH1').value = resultado.h1;
            document.getElementById('homeIntro').value = resultado.introParagraph;
            document.getElementById('home-content-inputs').classList.remove('hidden');
        }
        statusSpan.textContent = `Textos ${tipo} generados. Revisa y guarda.`;
         // Mostrar botón de guardar si alguna sección tiene contenido
        document.getElementById('btn-guardar-textos-home').parentNode.classList.remove('hidden');

    } catch (error) {
        statusSpan.textContent = `Error: ${error.message}`;
    } finally {
        btnSeo.disabled = false;
        btnContent.disabled = false;
    }
}

// Guarda los textos SEO y de contenido para Home
async function guardarTextosHome() {
    const btn = document.getElementById('btn-guardar-textos-home');
    const statusSpan = document.getElementById('ia-home-status');

    btn.disabled = true;
    statusSpan.textContent = 'Guardando textos de inicio...';

    try {
        const payload = {
            metaTitle: document.getElementById('homeMetaTitle').value,
            metaDescription: document.getElementById('homeMetaDescription').value,
            h1: document.getElementById('homeH1').value,
            introParagraph: document.getElementById('homeIntro').value
        };

        await fetchAPI('/website-config/home-settings', { method: 'PUT', body: payload });

        // Actualizar estado local general
        websiteSettingsEmpresa.seo = { homeTitle: payload.metaTitle, homeDescription: payload.metaDescription };
        websiteSettingsEmpresa.content = { homeH1: payload.h1, homeIntro: payload.introParagraph };

        statusSpan.textContent = 'Textos de inicio guardados con éxito.';
    } catch (error) {
        statusSpan.textContent = `Error al guardar: ${error.message}`;
    } finally {
        btn.disabled = false;
    }
}

// Sube la imagen de portada (Hero Image)
async function handleSubirHeroImage(file) {
    if (!file) return;

    const statusDiv = document.getElementById('hero-upload-status');
    statusDiv.textContent = 'Subiendo imagen de portada...';
    statusDiv.className = 'text-xs mt-1 text-blue-600';

    const formData = new FormData();
    formData.append('heroImage', file);

    try {
        const resultado = await fetchAPI('/website-config/upload-hero-image', {
            method: 'POST',
            body: formData
        });

        // Actualizar estado local general
        if (!websiteSettingsEmpresa.theme) websiteSettingsEmpresa.theme = {};
        websiteSettingsEmpresa.theme.heroImageUrl = resultado.url;
        websiteSettingsEmpresa.theme.heroImageAlt = resultado.alt;
        websiteSettingsEmpresa.theme.heroImageTitle = resultado.title;

        statusDiv.textContent = '¡Imagen de portada subida!';
        statusDiv.className = 'text-xs mt-1 text-green-600';
        renderizarSeccionImagenPortada(); // Re-renderizar para mostrar la nueva imagen y metadata

    } catch (error) {
        statusDiv.textContent = `Error al subir: ${error.message}`;
        statusDiv.className = 'text-xs mt-1 text-red-600';
    } finally {
        // Limpiar input
        document.getElementById('heroImageFile').value = '';
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
        // No necesitamos enviar nada en el body, el backend obtiene la desc. manual
        const resultado = await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/generate-ai-text`, {
            method: 'POST'
        });
        document.getElementById('aiDescriptionPropiedad').value = resultado.texto;
        document.getElementById('propiedad-desc-input-container').classList.remove('hidden'); // Mostrar textarea y botón guardar
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

        // Actualizar estado local de la propiedad
        websiteDataPropiedad.aiDescription = texto;
        statusSpan.textContent = 'Descripción guardada con éxito.';

        // Actualizar la propiedad en la lista local también
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

        // Actualizar estado local de la propiedad
        if (!websiteDataPropiedad.images) websiteDataPropiedad.images = {};
        if (!websiteDataPropiedad.images[componentId]) websiteDataPropiedad.images[componentId] = [];
        websiteDataPropiedad.images[componentId].push(...resultado);

        // Actualizar la propiedad en la lista global
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

        // Eliminar del estado local de la propiedad
        if (websiteDataPropiedad.images && websiteDataPropiedad.images[componentId]) {
            websiteDataPropiedad.images[componentId] = websiteDataPropiedad.images[componentId].filter(img => img.imageId !== imageId);
        }

        // Actualizar la propiedad en la lista global
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
            <p class="text-gray-600">
                Gestiona los textos SEO generados por IA y las imágenes para la página de inicio y cada alojamiento.
            </p>

            <div id="seccion-textos-home">
                </div>
            <div id="seccion-imagen-portada">
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
            fetchAPI('/empresa'), // Necesitamos los datos de la empresa para los prompts de Home
            fetchAPI('/propiedades')
        ]);

        // Guardar settings generales localmente
        websiteSettingsEmpresa = empresaInfo.websiteSettings || { seo: {}, content: {}, theme: {} };

        // Renderizar secciones de Home Page ahora que tenemos empresaInfo
        renderizarSeccionTextosHome();
        renderizarSeccionImagenPortada();

        // Poblar selector de propiedades
        propiedadSelect.innerHTML = '<option value="">-- Elige un alojamiento --</option>' +
            todasLasPropiedades.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

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