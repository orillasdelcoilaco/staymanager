// frontend/src/views/configurarWebPublica.js
import { fetchAPI } from '../api.js';

let todasLasPropiedades = [];
let empresaInfo = {};
let propiedadSeleccionada = null;
// Objeto de estado actualizado
let websiteDataPropiedad = { aiDescription: '', images: {}, cardImage: null };
let websiteSettingsEmpresa = { seo: {}, content: {}, theme: {}, general: {} };

// --- Funciones Auxiliares de Renderizado ---
// ... (renderizarSeccionTextosHome, renderizarSeccionImagenPortada, renderizarConfigGeneral - sin cambios) ...

// *** NUEVA FUNCIÓN: Renderizar sección de Imagen de Tarjeta ***
function renderizarSeccionImagenTarjeta() {
    const container = document.getElementById('seccion-imagen-tarjeta-propiedad');
    if (!container || !propiedadSeleccionada) return;

    const cardImage = websiteDataPropiedad.cardImage;
    const isListed = propiedadSeleccionada.googleHotelData?.isListed || false;
    let previewContent = '';

    if (cardImage && cardImage.storagePath) {
        // Mostrar imagen cargada
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
        // Mostrar advertencia si está listada y no tiene imagen
        previewContent = `<p class="text-sm font-medium text-red-600 mb-2">⚠️ Esta propiedad está "Listada" y requiere una imagen principal. Por favor, sube una imagen.</p>`;
    } else {
        // Mensaje normal si no está listada y no tiene imagen
        previewContent = `<p class="text-sm text-gray-500 mb-2">No se ha subido una imagen principal para la tarjeta.</p>`;
    }

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
    `;

    // Añadir listener al nuevo botón
    document.getElementById('upload-card-image-btn').addEventListener('click', handleSubirCardImage);
}


// Renderiza la sección de Texto de Propiedad (Descripción IA)
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

    // Listeners
    document.getElementById('btn-generar-ai-desc').addEventListener('click', generarTextoDescripcionPropiedad);
    // VALIDACIÓN añadida a esta función
    document.getElementById('btn-guardar-ai-desc').addEventListener('click', guardarTextoDescripcionPropiedad);
}


// Renderiza la sección de Gestión de Imágenes (Galería Adicional)
function renderizarGestorImagenes() {
    const container = document.getElementById('seccion-imagenes-propiedad');
    if (!container || !propiedadSeleccionada) return;

    // Verificar si la propiedad tiene componentes definidos
    if (!propiedadSeleccionada.componentes || propiedadSeleccionada.componentes.length === 0) {
        container.innerHTML = `<h3 class="text-lg font-semibold text-gray-800 mb-2">Imágenes Adicionales (Galería)</h3><p class="text-sm text-gray-500 p-4 border rounded-md bg-gray-50">Define 'Componentes Adicionales' en 'Gestionar Alojamientos' para subir más imágenes (ej: Dormitorio, Baño, Cocina).</p>`;
        return;
    }

    container.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Imágenes Adicionales (Galería)</h3>
        ${propiedadSeleccionada.componentes.map(componente => `
        <fieldset class="border p-4 rounded-md mb-4">
            {/* Leyenda simplificada, ya no busca Portada/Exterior */}
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

    // Re-adjuntar listeners (sin cambios)
    container.querySelectorAll('.subir-imagenes-input').forEach(input => {
        input.addEventListener('change', (e) => handleSubirImagenesPropiedad(e.target.dataset.componentId, e.target.files));
    });
    container.querySelectorAll('.eliminar-imagen-btn').forEach(button => {
        button.addEventListener('click', (e) => handleEliminarImagenPropiedad(e.currentTarget.dataset.componentId, e.currentTarget.dataset.imageId));
    });
}


// Renderiza las imágenes de un componente específico (sin cambios)
function renderizarImagenesComponente(componentId) {
    // ... (Esta función no necesita cambios)
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


// --- Funciones de Lógica y API ---

// Cargar datos de la propiedad (actualizado)
async function cargarDatosWebPropiedad(propiedadId) {
    if (!propiedadId) return;
    document.getElementById('seccion-imagen-tarjeta-propiedad').innerHTML = '<p class="text-sm text-gray-500">Cargando...</p>';
    document.getElementById('seccion-texto-propiedad').innerHTML = '<p class="text-sm text-gray-500">Cargando...</p>';
    document.getElementById('seccion-imagenes-propiedad').innerHTML = '';

    // Encontrar la propiedad completa (incluyendo googleHotelData)
    propiedadSeleccionada = todasLasPropiedades.find(p => p.id === propiedadId);
    
    try {
        // Obtener datos web (descripción, imágenes, cardImage)
        const data = await fetchAPI(`/website-config/propiedad/${propiedadId}`);
        // Actualizar estado local con la nueva estructura
        websiteDataPropiedad = {
            aiDescription: data.aiDescription || '',
            images: data.images || {},
            cardImage: data.cardImage || null // Nuevo campo
        };
    } catch (error) {
        console.error("Error cargando datos web de la propiedad:", error);
        websiteDataPropiedad = { aiDescription: '', images: {}, cardImage: null }; // Estado default
        document.getElementById('seccion-texto-propiedad').innerHTML = `<p class="text-red-500">Error al cargar datos.</p>`;
    }

    // Renderizar todas las secciones de la propiedad
    renderizarSeccionImagenTarjeta();
    renderizarSeccionTextoPropiedad();
    renderizarGestorImagenes();
}

// ... (generarTextosHomeIA, guardarTextosHome, handleSubirHeroImage - sin cambios) ...

// Generar Descripción IA (sin cambios)
async function generarTextoDescripcionPropiedad() {
    // ... (Esta función no necesita cambios)
    if (!propiedadSeleccionada) return;
    const btn = document.getElementById('btn-generar-ai-desc');
    const textarea = document.getElementById('ai-description-textarea');
    btn.disabled = true;
    btn.innerHTML = 'Generando...';
    try {
        const { texto } = await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/generate-ai-text`, { method: 'POST' });
        textarea.value = texto;
        websiteDataPropiedad.aiDescription = texto; // Sincronizar estado local
    } catch (error) {
        alert(`Error generando texto: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Generar con IA';
    }
}

// Guardar Descripción IA (CON VALIDACIÓN)
async function guardarTextoDescripcionPropiedad() {
    if (!propiedadSeleccionada) return;

    const isListed = propiedadSeleccionada.googleHotelData?.isListed || false;
    // Usar el estado local 'websiteDataPropiedad' para la validación
    const hasCardImage = websiteDataPropiedad.cardImage && websiteDataPropiedad.cardImage.storagePath;

    // *** VALIDACIÓN DEL LADO DEL CLIENTE ***
    if (isListed && !hasCardImage) {
        alert('Error: No se puede guardar.\nEsta propiedad está marcada como "Listada" pero no tiene una "Imagen Principal (Tarjeta/Home)".\n\nPor favor, sube la imagen principal primero usando el botón "Subir Imagen" en la sección de arriba.');
        return; // Detener el guardado
    }
    // *** FIN VALIDACIÓN ***

    const aiDescription = document.getElementById('ai-description-textarea')?.value;
    const statusEl = document.getElementById('save-ai-description-status');
    statusEl.textContent = 'Guardando...';
    statusEl.classList.remove('text-red-500');

    try {
        await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}`, {
            method: 'PUT',
            body: { aiDescription } // Solo envía la descripción
        });
        statusEl.textContent = 'Descripción guardada con éxito.';
        websiteDataPropiedad.aiDescription = aiDescription; // Sincronizar estado
    } catch (error) {
        console.error('Error guardando descripción:', error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
        // Mostrar el error de validación específico si vino del backend
        if (error.error === 'VALIDATION_ERROR') {
            alert(`Error del servidor: ${error.message}`);
        }
    }
}

// *** NUEVA FUNCIÓN: Handler para subir Imagen de Tarjeta ***
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
    formData.append('cardImage', file); // El nombre debe coincidir con upload.single('cardImage')

    try {
        const result = await fetchAPI(`/website-config/propiedad/${propiedadSeleccionada.id}/upload-card-image`, {
            method: 'POST',
            body: formData
            // No 'Content-Type', fetch lo maneja
        });

        // Actualizar el estado local
        websiteDataPropiedad.cardImage = result;
        
        statusEl.textContent = '¡Imagen subida con éxito!';
        statusEl.classList.add('text-green-500');
        renderizarSeccionImagenTarjeta(); // Re-renderizar la preview
        input.value = ''; // Limpiar input

    } catch (error) {
        console.error('Error subiendo imagen de tarjeta:', error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
    } finally {
        document.getElementById('upload-card-image-btn').disabled = false;
    }
}


// Subir Imágenes de Galería (sin cambios)
async function handleSubirImagenesPropiedad(componentId, files) {
    // ... (Esta función no necesita cambios)
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

// Eliminar Imagen de Galería (sin cambios)
async function handleEliminarImagenPropiedad(componentId, imageId) {
    // ... (Esta función no necesita cambios)
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
            
            {/* Secciones de Home Page */}
            <div id="seccion-config-general"></div>
            <div id="seccion-textos-home"></div>
            <div id="seccion-imagen-portada"></div>
            <div class="text-right border-t pt-4">
                <button id="save-empresa-config-btn" class="btn-primary btn-lg">Guardar Configuración General</button>
            </div>
            
            {/* Sección de Propiedades */}
            <div class="border-t pt-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Contenido por Alojamiento Específico</h3>
                 <div>
                    <label for="propiedad-select" class="block text-sm font-medium text-gray-700">Seleccionar Alojamiento</label>
                    <select id="propiedad-select" class="form-select mt-1">
                        <option value="">-- Elige un alojamiento --</option>
                    </select>
                </div>

                <div id="config-container-propiedad" class="hidden space-y-6 mt-4">
                    
                    {/* *** NUEVO CONTENEDOR PARA IMAGEN DE TARJETA *** */}
                    <div id="seccion-imagen-tarjeta-propiedad">
                        {/* Renderizado por renderizarSeccionImagenTarjeta() */}
                    </div>

                    {/* Contenedor para Descripción IA */}
                    <div id="seccion-texto-propiedad">
                        {/* Renderizado por renderizarSeccionTextoPropiedad() */}
                    </div>
                    
                    {/* Contenedor para Galería Adicional */}
                    <div id="seccion-imagenes-propiedad">
                        {/* Renderizado por renderizarGestorImagenes() */}
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    const propiedadSelect = document.getElementById('propiedad-select');
    const configContainerPropiedad = document.getElementById('config-container-propiedad');

    // Cargar datos iniciales
    try {
        [empresaInfo, todasLasPropiedades] = await Promise.all([
            fetchAPI('/empresa'),
            fetchAPI('/propiedades')
        ]);
        const configWeb = await fetchAPI('/website-config/configuracion-web');
        // ... (asignación de websiteSettingsEmpresa sin cambios)
        websiteSettingsEmpresa.general = { subdomain: configWeb.subdomain || '', domain: configWeb.domain || '' };
        websiteSettingsEmpresa.theme = configWeb.theme || {};
        websiteSettingsEmpresa.content = configWeb.content || {};
        websiteSettingsEmpresa.seo = configWeb.seo || {};

        renderizarConfigGeneral();
        renderizarSeccionTextosHome();
        renderizarSeccionImagenPortada();

        // Poblar selector de propiedades (solo las que tienen componentes)
        propiedadSelect.innerHTML = '<option value="">-- Elige un alojamiento --</option>' +
            todasLasPropiedades
            .sort((a, b) => a.nombre.localeCompare(b.nombre)) // Ordenar alfabéticamente
            .map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

        // Listeners para el Home (sin cambios)
        document.getElementById('btn-generar-home-seo').addEventListener('click', () => generarTextosHomeIA('seo'));
        document.getElementById('btn-generar-home-content').addEventListener('click', () => generarTextosHomeIA('content'));
        document.getElementById('save-empresa-config-btn').addEventListener('click', guardarTextosHome);
        document.getElementById('upload-hero-image-btn').addEventListener('click', handleSubirHeroImage);

    } catch (error) {
        console.error("Error cargando datos iniciales:", error);
        document.getElementById('seccion-config-general').innerHTML = `<p class="text-red-500">Error al cargar: ${error.message}</p>`;
    }

    // Listener para cuando se selecciona una propiedad (actualizado)
    propiedadSelect.addEventListener('change', async (e) => {
        const propiedadId = e.target.value;
        if (propiedadId) {
            configContainerPropiedad.classList.remove('hidden');
            // Carga todos los datos y renderiza las 3 secciones
            await cargarDatosWebPropiedad(propiedadId); 
        } else {
            propiedadSeleccionada = null;
            websiteDataPropiedad = { aiDescription: '', images: {}, cardImage: null }; // Resetear estado
            configContainerPropiedad.classList.add('hidden');
            // Limpiar los 3 contenedores
            document.getElementById('seccion-imagen-tarjeta-propiedad').innerHTML = '';
            document.getElementById('seccion-texto-propiedad').innerHTML = '';
            document.getElementById('seccion-imagenes-propiedad').innerHTML = '';
        }
    });
}