// frontend/src/views/configurarWebPublica.js
import { fetchAPI } from '../api.js';

let todasLasPropiedades = [];
let propiedadSeleccionada = null; // Guardará el objeto completo de la propiedad seleccionada
let websiteDataActual = { aiDescription: '', images: {} }; // Guardará los datos web (texto IA, imágenes)

// --- Funciones Auxiliares de Renderizado ---

// Renderiza la sección de Texto SEO
function renderizarSeccionTexto() {
    const container = document.getElementById('seccion-texto-seo');
    if (!container || !propiedadSeleccionada) return;

    container.innerHTML = `
        <fieldset class="border p-4 rounded-md">
            <legend class="px-2 font-semibold text-gray-700">Textos SEO (Generado por IA)</legend>
            <div class="mt-4 space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-500">Descripción Actual (Base para IA)</label>
                    <p class="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-md border min-h-[60px]">
                        ${propiedadSeleccionada.descripcion || 'No hay descripción base.'}
                    </p>
                </div>
                <div>
                    <button id="btn-generar-texto-ia" class="btn-secondary text-sm">✨ Generar Texto SEO con IA</button>
                    <span id="ia-status" class="ml-2 text-sm text-gray-500"></span>
                </div>
                <div>
                    <label for="aiDescription" class="block text-sm font-medium text-gray-700">Descripción Optimizada (Editable)</label>
                    <textarea id="aiDescription" name="aiDescription" rows="8" class="form-input mt-1">${websiteDataActual.aiDescription || ''}</textarea>
                </div>
                <div class="text-right">
                    <button id="btn-guardar-texto" class="btn-primary">Guardar Texto</button>
                </div>
            </div>
        </fieldset>
    `;

    // Añadir listeners a los nuevos botones
    document.getElementById('btn-generar-texto-ia')?.addEventListener('click', generarTextoIA);
    document.getElementById('btn-guardar-texto')?.addEventListener('click', guardarTextoIA);
}

// Renderiza la sección de Gestión de Imágenes (por componentes)
function renderizarGestorImagenes() {
    const container = document.getElementById('seccion-imagenes');
    if (!container || !propiedadSeleccionada || !propiedadSeleccionada.componentes || propiedadSeleccionada.componentes.length === 0) {
        container.innerHTML = `<p class="text-sm text-gray-500 p-4 border rounded-md">Primero define los 'Componentes' de este alojamiento en la sección 'Gestionar Alojamientos'.</p>`;
        return;
    }

    container.innerHTML = propiedadSeleccionada.componentes.map(componente => `
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
        input.addEventListener('change', (e) => handleSubirImagenes(e.target.dataset.componentId, e.target.files));
    });
    // Volver a añadir listeners a los botones de eliminar imagen CADA VEZ que se renderiza
    container.querySelectorAll('.eliminar-imagen-btn').forEach(button => {
        // Eliminar listener anterior si existe para evitar duplicados
        button.replaceWith(button.cloneNode(true));
    });
    // Añadir el listener a los botones clonados
    container.querySelectorAll('.eliminar-imagen-btn').forEach(button => {
        button.addEventListener('click', (e) => handleEliminarImagen(e.currentTarget.dataset.componentId, e.currentTarget.dataset.imageId));
    });
}


// Renderiza las imágenes de un componente específico
function renderizarImagenesComponente(componentId) {
    const imagenes = websiteDataActual.images?.[componentId] || [];
    if (imagenes.length === 0) {
        return '<p class="text-xs text-gray-500 col-span-full">No hay imágenes para este componente.</p>';
    }

    // Asegurarse de que storagePath sea una URL válida para la etiqueta img src
    const getImageUrl = (storagePath) => {
        if (!storagePath) return '';
        // Asume que storagePath ya es la URL pública https://storage.googleapis.com/...
        return storagePath;
    };

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

// Carga los datos web (texto IA, imágenes) de la propiedad seleccionada
async function cargarDatosWebPropiedad(propiedadId) {
    const textoContainer = document.getElementById('seccion-texto-seo');
    const imagenesContainer = document.getElementById('seccion-imagenes');
    textoContainer.innerHTML = '<p class="text-sm text-gray-500">Cargando datos...</p>';
    imagenesContainer.innerHTML = ''; // Limpiar mientras carga

    try {
        // Usamos la info completa de la propiedad que ya tenemos
        propiedadSeleccionada = todasLasPropiedades.find(p => p.id === propiedadId);
        if (!propiedadSeleccionada) throw new Error('Propiedad no encontrada localmente.');

        // Asegurarse de que websiteData y sus sub-objetos existan
        websiteDataActual = propiedadSeleccionada.websiteData || { aiDescription: '', images: {} };
        if (!websiteDataActual.images) {
            websiteDataActual.images = {};
        }

        // Renderizamos las secciones con los datos cargados
        renderizarSeccionTexto();
        renderizarGestorImagenes();

    } catch (error) {
        console.error("Error al cargar datos web:", error);
        textoContainer.innerHTML = `<p class="text-red-500">Error al cargar datos: ${error.message}</p>`;
    }
}

// Llama a la API para generar el texto SEO
async function generarTextoIA() {
    if (!propiedadSeleccionada) return;

    const btn = document.getElementById('btn-generar-texto-ia');
    const statusSpan = document.getElementById('ia-status');
    btn.disabled = true;
    statusSpan.textContent = 'Generando texto...';

    try {
        const payload = {
            // Pasar la descripción actual real como base
            descripcionActual: propiedadSeleccionada.descripcion || `Alojamiento llamado ${propiedadSeleccionada.nombre}`
        };
        const resultado = await fetchAPI(`/api/website-config/propiedad/${propiedadSeleccionada.id}/generate-ai-text`, {
            method: 'POST',
            body: payload
        });
        document.getElementById('aiDescription').value = resultado.texto;
        statusSpan.textContent = 'Texto generado.';
    } catch (error) {
        statusSpan.textContent = `Error: ${error.message}`;
    } finally {
        btn.disabled = false;
    }
}

// Guarda el texto SEO editado
async function guardarTextoIA() {
    if (!propiedadSeleccionada) return;

    const btn = document.getElementById('btn-guardar-texto');
    const statusSpan = document.getElementById('ia-status'); // Usamos el mismo span para feedback
    const texto = document.getElementById('aiDescription').value;

    btn.disabled = true;
    statusSpan.textContent = 'Guardando texto...';

    try {
        // Enviar solo la descripción IA para actualizarla
        const payload = {
            aiDescription: texto
        };
        // Usar la ruta específica para actualizar websiteData
        await fetchAPI(`/api/website-config/propiedad/${propiedadSeleccionada.id}`, {
            method: 'PUT',
            body: payload
        });

        // Actualizar estado local
        websiteDataActual.aiDescription = texto;
        statusSpan.textContent = 'Texto guardado con éxito.';

        // Actualizar la propiedad en la lista local también
        const index = todasLasPropiedades.findIndex(p => p.id === propiedadSeleccionada.id);
        if (index !== -1) {
             // Asegurarse de que websiteData exista antes de asignar
            if (!todasLasPropiedades[index].websiteData) {
                 todasLasPropiedades[index].websiteData = { images: {} };
            }
            todasLasPropiedades[index].websiteData.aiDescription = texto;
        }

    } catch (error) {
        statusSpan.textContent = `Error al guardar: ${error.message}`;
    } finally {
        btn.disabled = false;
        // statusSpan.textContent = ''; // Opcional: limpiar mensaje después de un tiempo
    }
}

// Sube imágenes para un componente específico
async function handleSubirImagenes(componentId, files) {
    if (!propiedadSeleccionada || files.length === 0) return;

    const statusDiv = document.getElementById(`upload-status-${componentId}`);
    statusDiv.textContent = `Subiendo ${files.length} imágen(es)...`;
    statusDiv.className = 'text-xs mt-1 text-blue-600';

    const formData = new FormData();
    for (const file of files) {
        formData.append('images', file); // 'images' debe coincidir con upload.array('images') en el backend
    }

    try {
        const resultado = await fetchAPI(`/api/website-config/propiedad/${propiedadSeleccionada.id}/upload-image/${componentId}`, {
            method: 'POST',
            body: formData
        });

        // Actualizar el estado local con las nuevas imágenes
        if (!websiteDataActual.images) websiteDataActual.images = {};
        if (!websiteDataActual.images[componentId]) websiteDataActual.images[componentId] = [];
        websiteDataActual.images[componentId].push(...resultado);

        // Actualizar también la propiedad en la lista global
        const index = todasLasPropiedades.findIndex(p => p.id === propiedadSeleccionada.id);
         if (index !== -1) {
            todasLasPropiedades[index].websiteData = websiteDataActual;
        }

        statusDiv.textContent = `¡${files.length} imágen(es) subida(s) y procesada(s)!`;
        statusDiv.className = 'text-xs mt-1 text-green-600';
        renderizarGestorImagenes(); // Re-renderizar para mostrar las nuevas imágenes y añadir listeners
    } catch (error) {
        statusDiv.textContent = `Error al subir: ${error.message}`;
        statusDiv.className = 'text-xs mt-1 text-red-600';
    } finally {
        // Limpiar el input de archivo para permitir subir el mismo archivo de nuevo si es necesario
        const inputFile = document.querySelector(`.subir-imagenes-input[data-component-id="${componentId}"]`);
        if (inputFile) inputFile.value = '';
    }
}

// Elimina una imagen específica
async function handleEliminarImagen(componentId, imageId) {
    if (!propiedadSeleccionada || !confirm('¿Estás seguro de eliminar esta imagen?')) return;

    // Podríamos añadir un indicador visual de 'eliminando...' aquí
    const button = document.querySelector(`.eliminar-imagen-btn[data-image-id="${imageId}"]`);
    if(button) button.disabled = true; // Deshabilitar botón mientras se elimina

    try {
        await fetchAPI(`/api/website-config/propiedad/${propiedadSeleccionada.id}/delete-image/${componentId}/${imageId}`, {
            method: 'DELETE'
        });

        // Eliminar del estado local
        if (websiteDataActual.images && websiteDataActual.images[componentId]) {
            websiteDataActual.images[componentId] = websiteDataActual.images[componentId].filter(img => img.imageId !== imageId);
        }

        // Actualizar la propiedad en la lista global
         const index = todasLasPropiedades.findIndex(p => p.id === propiedadSeleccionada.id);
         if (index !== -1) {
            todasLasPropiedades[index].websiteData = websiteDataActual;
        }

        renderizarGestorImagenes(); // Re-renderizar la galería del componente
    } catch (error) {
        alert(`Error al eliminar imagen: ${error.message}`);
         if(button) button.disabled = false; // Rehabilitar si falla
    }
}


// --- Renderizado Principal y Lógica de Eventos ---

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-6">
            <h2 class="text-2xl font-semibold text-gray-900">Configurar Contenido Web Público por Alojamiento</h2>
            <p class="text-gray-600">
                Selecciona un alojamiento para generar su descripción SEO con IA y gestionar las imágenes
                que se mostrarán en su página pública y en las integraciones.
            </p>

            <div>
                <label for="propiedad-select" class="block text-sm font-medium text-gray-700">Seleccionar Alojamiento</label>
                <select id="propiedad-select" class="form-select mt-1">
                    <option value="">-- Elige un alojamiento --</option>
                    </select>
            </div>

            <div id="config-container" class="hidden space-y-6">
                <div id="seccion-texto-seo">
                    </div>
                <div id="seccion-imagenes">
                    </div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    const propiedadSelect = document.getElementById('propiedad-select');
    const configContainer = document.getElementById('config-container');

    // Cargar propiedades para el selector
    try {
        // **CORRECCIÓN:** Asegurarse de que el endpoint incluye /api
        todasLasPropiedades = await fetchAPI('/api/propiedades');
        propiedadSelect.innerHTML = '<option value="">-- Elige un alojamiento --</option>' +
            todasLasPropiedades.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    } catch (error) {
        propiedadSelect.innerHTML = '<option value="">Error al cargar alojamientos</option>';
        console.error("Error cargando propiedades:", error);
    }

    // Listener para cuando se selecciona una propiedad
    propiedadSelect.addEventListener('change', async (e) => {
        const propiedadId = e.target.value;
        if (propiedadId) {
            configContainer.classList.remove('hidden');
            await cargarDatosWebPropiedad(propiedadId);
        } else {
            propiedadSeleccionada = null;
            websiteDataActual = { aiDescription: '', images: {} };
            configContainer.classList.add('hidden');
            document.getElementById('seccion-texto-seo').innerHTML = '';
            document.getElementById('seccion-imagenes').innerHTML = '';
        }
    });
}