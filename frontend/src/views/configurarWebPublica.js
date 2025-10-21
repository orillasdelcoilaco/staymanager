// frontend/src/views/configurarWebPublica.js
import { fetchAPI } from '../api.js';

let empresaConfig = {};
let selectedPropiedadId = null; // Para saber qué propiedad estamos configurando
let currentPropiedadWebsiteData = {}; // Almacena websiteData de la propiedad seleccionada

// Función para cargar la configuración web de la empresa
async function loadEmpresaConfig() {
    try {
        empresaConfig = await fetchAPI('/website-config/configuracion-web');
        document.getElementById('home-h1').value = empresaConfig.content?.homeH1 || '';
        document.getElementById('home-intro').value = empresaConfig.content?.homeIntro || '';
        document.getElementById('seo-home-title').value = empresaConfig.seo?.homeTitle || '';
        document.getElementById('seo-home-description').value = empresaConfig.seo?.homeDescription || '';
        document.getElementById('theme-primary-color').value = empresaConfig.theme?.primaryColor || '#4f46e5';
        document.getElementById('theme-secondary-color').value = empresaConfig.theme?.secondaryColor || '#f87171';
        document.getElementById('subdomain-input').value = empresaConfig.subdomain || '';
        document.getElementById('domain-input').value = empresaConfig.domain || '';
        document.getElementById('logo-url-input').value = empresaConfig.theme?.logoUrl || '';

        // Mostrar imagen del Hero si existe
        const heroImagePreview = document.getElementById('hero-image-preview');
        const heroImageUrl = empresaConfig.theme?.heroImageUrl;
        if (heroImageUrl) {
            heroImagePreview.src = heroImageUrl;
            heroImagePreview.classList.remove('hidden');
        } else {
            heroImagePreview.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error al cargar la configuración de la empresa:", error);
        alert("Error al cargar la configuración de la empresa.");
    }
}

async function guardarEmpresaConfig() {
    const btn = document.getElementById('save-empresa-config-btn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const payload = {
        general: {
            subdomain: document.getElementById('subdomain-input').value.trim(),
            domain: document.getElementById('domain-input').value.trim()
        },
        theme: {
            logoUrl: document.getElementById('logo-url-input').value.trim(),
            primaryColor: document.getElementById('theme-primary-color').value,
            secondaryColor: document.getElementById('theme-secondary-color').value,
            heroImageUrl: document.getElementById('hero-image-preview').src === 'about:blank' || document.getElementById('hero-image-preview').classList.contains('hidden') ? null : document.getElementById('hero-image-preview').src,
            heroImageAlt: document.getElementById('hero-image-alt').value.trim(),
            heroImageTitle: document.getElementById('hero-image-title').value.trim()
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

    try {
        await fetchAPI('/website-config/configuracion-web', {
            method: 'PUT',
            body: payload
        });
        alert('Configuración de la empresa guardada con éxito.');
    } catch (error) {
        console.error("Error al guardar la configuración de la empresa:", error);
        alert(`Error al guardar: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Configuración de la Empresa';
    }
}

async function handleHeroImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('heroImage', file);

    const uploadBtn = document.getElementById('upload-hero-image-btn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Subiendo...';

    try {
        const response = await fetchAPI('/website-config/upload-hero-image', {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'multipart/form-data' } // Importante: Firebase Storage requiere esta cabecera
        });
        document.getElementById('hero-image-preview').src = response.imageUrl;
        document.getElementById('hero-image-preview').classList.remove('hidden');
        alert('Imagen de portada subida con éxito.');
        // Actualizar la configuración para reflejar la nueva URL
        empresaConfig.theme = empresaConfig.theme || {};
        empresaConfig.theme.heroImageUrl = response.imageUrl;
    } catch (error) {
        console.error("Error al subir imagen del Hero:", error);
        alert(`Error al subir imagen: ${error.message}`);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Subir Imagen del Hero';
        event.target.value = ''; // Limpiar input para permitir subir la misma imagen de nuevo
    }
}


// Función para cargar propiedades en el select
async function loadPropiedadesForSelect() {
    try {
        const propiedades = await fetchAPI('/propiedades');
        const select = document.getElementById('propiedad-select');
        select.innerHTML = '<option value="">Selecciona una propiedad</option>' +
            propiedades.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    } catch (error) {
        console.error("Error al cargar propiedades:", error);
    }
}

// Función para cargar la configuración web de una propiedad específica
async function loadPropiedadWebsiteConfig(propiedadId) {
    selectedPropiedadId = propiedadId;
    document.getElementById('propiedad-config-section').classList.remove('hidden');

    try {
        const propiedad = await fetchAPI(`/propiedades/${propiedadId}`);
        currentPropiedadWebsiteData = propiedad.websiteData || { aiDescription: '', images: {} };

        document.getElementById('propiedad-ai-description').value = currentPropiedadWebsiteData.aiDescription || '';
        renderPropiedadImages();

    } catch (error) {
        console.error("Error al cargar configuración de propiedad:", error);
        alert("Error al cargar la configuración de la propiedad.");
        document.getElementById('propiedad-config-section').classList.add('hidden');
    }
}

// Renderiza las imágenes de la propiedad en el formulario
function renderPropiedadImages() {
    const imagesContainer = document.getElementById('propiedad-images-container');
    imagesContainer.innerHTML = ''; // Limpiar

    const tiposComponente = [
        'Portada Recinto', 'Exterior Alojamiento', 'Dormitorio', 'Baño', 'Cocina',
        'Living', 'Comedor', 'Terraza', 'Tina', 'Otro'
    ];

    tiposComponente.forEach(tipo => {
        const key = tipo.toLowerCase().replace(/\s+/g, '');
        const images = currentPropiedadWebsiteData.images?.[key] || [];

        imagesContainer.innerHTML += `
            <div class="mb-6 border p-4 rounded-md bg-gray-50">
                <h4 class="font-semibold text-gray-700 mb-3">${tipo}</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3" id="images-list-${key}">
                    ${images.map(img => `
                        <div class="relative group">
                            <img src="${img.storagePath}" alt="${img.altText || ''}" class="w-full h-32 object-cover rounded-md">
                            <button type="button" data-key="${key}" data-path="${img.storagePath}" class="remove-prop-image-btn absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                &times;
                            </button>
                        </div>
                    `).join('')}
                </div>
                <input type="file" id="upload-image-${key}" data-key="${key}" class="prop-image-upload-input hidden" accept="image/*" multiple>
                <label for="upload-image-${key}" class="btn-secondary cursor-pointer block text-center py-2 px-4 rounded-md text-sm">
                    Subir Imágenes para ${tipo}
                </label>
            </div>
        `;
    });

    // Añadir event listeners para los botones de eliminar
    imagesContainer.querySelectorAll('.remove-prop-image-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('¿Seguro que quieres eliminar esta imagen?')) return;
            const key = e.target.dataset.key;
            const pathToRemove = e.target.dataset.path;

            // Eliminar del Storage y luego actualizar la propiedad
            try {
                await fetchAPI('/storage/delete-file', { method: 'POST', body: { filePath: pathToRemove } });
                
                // Eliminar del currentPropiedadWebsiteData
                if (currentPropiedadWebsiteData.images && currentPropiedadWebsiteData.images[key]) {
                    currentPropiedadWebsiteData.images[key] = currentPropiedadWebsiteData.images[key].filter(img => img.storagePath !== pathToRemove);
                }
                await savePropiedadWebsiteConfig(); // Guardar el estado actualizado de la propiedad
                renderPropiedadImages(); // Volver a renderizar
            } catch (error) {
                console.error("Error al eliminar imagen:", error);
                alert(`Error al eliminar imagen: ${error.message}`);
            }
        });
    });

    // Añadir event listeners para los inputs de tipo file
    imagesContainer.querySelectorAll('.prop-image-upload-input').forEach(input => {
        input.addEventListener('change', handlePropiedadImageUpload);
    });
}

// Manejar la subida de imágenes de la propiedad
async function handlePropiedadImageUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const key = event.target.dataset.key;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }
    formData.append('entityType', 'propiedad');
    formData.append('entityId', selectedPropiedadId);
    formData.append('componentName', key);

    event.target.disabled = true;
    event.target.previousElementSibling.textContent = 'Subiendo...'; // Cambiar texto del label

    try {
        const response = await fetchAPI('/storage/upload-multiple', {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Actualizar currentPropiedadWebsiteData con las nuevas URLs
        currentPropiedadWebsiteData.images = currentPropiedadWebsiteData.images || {};
        currentPropiedadWebsiteData.images[key] = [
            ...(currentPropiedadWebsiteData.images[key] || []),
            ...response.uploadedImages.map(img => ({ storagePath: img.url, altText: '', title: '' }))
        ];

        await savePropiedadWebsiteConfig(); // Guardar el estado actualizado de la propiedad
        renderPropiedadImages(); // Volver a renderizar
        alert('Imágenes subidas con éxito.');
    } catch (error) {
        console.error("Error al subir imágenes de propiedad:", error);
        alert(`Error al subir imágenes: ${error.message}`);
    } finally {
        event.target.disabled = false;
        event.target.previousElementSibling.textContent = `Subir Imágenes para ${key.charAt(0).toUpperCase() + key.slice(1)}`;
        event.target.value = ''; // Limpiar input
    }
}


// Función para guardar la configuración web de la propiedad
async function savePropiedadWebsiteConfig() {
    if (!selectedPropiedadId) return;

    const btn = document.getElementById('save-propiedad-config-btn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const payload = {
        websiteData: {
            aiDescription: document.getElementById('propiedad-ai-description').value,
            images: currentPropiedadWebsiteData.images // Se guardan las imágenes actuales
        }
    };

    try {
        await fetchAPI(`/propiedades/${selectedPropiedadId}`, {
            method: 'PUT',
            body: payload
        });
        // alert('Configuración de la propiedad guardada con éxito.'); // No mostrar aquí para no molestar tras cada imagen
    } catch (error) {
        console.error("Error al guardar la configuración de la propiedad:", error);
        alert(`Error al guardar la configuración de la propiedad: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Configuración de la Propiedad';
    }
}

// Generar descripción IA
async function generarAIDescription() {
    if (!selectedPropiedadId) {
        alert('Por favor, selecciona una propiedad primero.');
        return;
    }
    const btn = document.getElementById('generate-ai-description-btn');
    btn.disabled = true;
    btn.textContent = 'Generando...';

    try {
        const response = await fetchAPI(`/propiedades/${selectedPropiedadId}/generar-descripcion-ia`, {
            method: 'POST'
        });
        document.getElementById('propiedad-ai-description').value = response.description;
        currentPropiedadWebsiteData.aiDescription = response.description; // Actualizar localmente
        await savePropiedadWebsiteConfig(); // Guardar la descripción generada
        alert('Descripción IA generada y guardada con éxito.');
    } catch (error) {
        console.error("Error al generar descripción IA:", error);
        alert(`Error al generar descripción IA: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generar Descripción con IA';
    }
}


export function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-6">Configurar Web Pública</h2>

            <div class="p-4 border rounded-md bg-gray-50">
                <h3 class="font-semibold text-gray-800 mb-4">1. Configuración de la Empresa (Home)</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label for="subdomain-input" class="block text-sm font-medium text-gray-700">Subdominio (Ej: prueba1)</label>
                        <input type="text" id="subdomain-input" class="form-input mt-1" placeholder="ej: miempresa">
                        <p class="text-xs text-gray-500 mt-1">Tu web será: https://[subdominio].onrender.com</p>
                    </div>
                     <div>
                        <label for="domain-input" class="block text-sm font-medium text-gray-700">Dominio Personalizado (Ej: miempresa.com)</label>
                        <input type="text" id="domain-input" class="form-input mt-1" placeholder="ej: miempresa.com">
                        <p class="text-xs text-gray-500 mt-1">Requiere configuración de DNS externa.</p>
                    </div>
                    <div>
                        <label for="home-h1" class="block text-sm font-medium text-gray-700">Título Principal (H1) del Home</label>
                        <input type="text" id="home-h1" class="form-input mt-1" placeholder="Ej: Cabañas El Bosque">
                    </div>
                    <div>
                        <label for="home-intro" class="block text-sm font-medium text-gray-700">Texto Introductorio del Home</label>
                        <textarea id="home-intro" rows="3" class="form-input mt-1" placeholder="Ej: Relájate en la naturaleza con nuestras cómodas cabañas."></textarea>
                    </div>
                </div>

                <div class="border-t pt-4 mt-6">
                    <h4 class="font-semibold text-gray-700 mb-3">SEO y Apariencia del Home</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label for="seo-home-title" class="block text-sm font-medium text-gray-700">SEO Title (Título de la pestaña)</label>
                            <input type="text" id="seo-home-title" class="form-input mt-1" placeholder="Ej: Cabañas El Bosque - Reserva Directa">
                        </div>
                        <div>
                            <label for="seo-home-description" class="block text-sm font-medium text-gray-700">SEO Description (Descripción para buscadores)</label>
                            <textarea id="seo-home-description" rows="3" class="form-input mt-1" placeholder="Ej: Alquiler de cabañas cómodas y seguras en la naturaleza."></textarea>
                        </div>
                         <div>
                            <label for="theme-primary-color" class="block text-sm font-medium text-gray-700">Color Primario</label>
                            <input type="color" id="theme-primary-color" class="form-input mt-1 h-10 w-full">
                        </div>
                        <div>
                            <label for="theme-secondary-color" class="block text-sm font-medium text-gray-700">Color Secundario</label>
                            <input type="color" id="theme-secondary-color" class="form-input mt-1 h-10 w-full">
                        </div>
                         <div>
                            <label for="logo-url-input" class="block text-sm font-medium text-gray-700">URL del Logo (opcional)</label>
                            <input type="url" id="logo-url-input" class="form-input mt-1" placeholder="https://ejemplo.com/mi-logo.png">
                            <p class="text-xs text-gray-500 mt-1">Dejar vacío para usar el nombre de la empresa.</p>
                        </div>
                         <div>
                            <label class="block text-sm font-medium text-gray-700">Imagen de Portada (Hero)</label>
                            <div class="mt-1 flex items-center space-x-3">
                                <img id="hero-image-preview" src="about:blank" alt="Previsualización Hero" class="h-24 w-auto object-cover rounded-md border hidden">
                                <input type="file" id="hero-image-upload" accept="image/*" class="hidden">
                                <label for="hero-image-upload" id="upload-hero-image-btn" class="btn-secondary cursor-pointer">
                                    Subir Imagen del Hero
                                </label>
                            </div>
                            <input type="text" id="hero-image-alt" class="form-input mt-2" placeholder="Texto alternativo (alt) para la imagen">
                            <input type="text" id="hero-image-title" class="form-input mt-2" placeholder="Título (tooltip) para la imagen">
                        </div>
                    </div>
                </div>
                <div class="flex justify-end pt-4 mt-6 border-t">
                    <button id="save-empresa-config-btn" class="btn-primary">Guardar Configuración de la Empresa</button>
                </div>
            </div>

            <div class="p-4 border rounded-md bg-gray-50">
                <h3 class="font-semibold text-gray-800 mb-4">2. Configuración por Alojamiento</h3>
                <div class="mb-4">
                    <label for="propiedad-select" class="block text-sm font-medium text-gray-700">Selecciona un Alojamiento</label>
                    <select id="propiedad-select" class="form-select mt-1"></select>
                </div>

                <div id="propiedad-config-section" class="hidden border-t pt-4 mt-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Descripción e Imágenes del Alojamiento</h4>
                    <div class="mb-4">
                        <label for="propiedad-ai-description" class="block text-sm font-medium text-gray-700">Descripción para la Web (Generada por IA)</label>
                        <textarea id="propiedad-ai-description" rows="6" class="form-input w-full mt-1"></textarea>
                        <button id="generate-ai-description-btn" class="btn-secondary mt-2">Generar Descripción con IA</button>
                    </div>

                    <div id="propiedad-images-container" class="mt-6">
                        </div>

                    <div class="flex justify-end pt-4 mt-6 border-t">
                        <button id="save-propiedad-config-btn" class="btn-primary">Guardar Configuración de la Propiedad</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    loadEmpresaConfig();
    loadPropiedadesForSelect();

    document.getElementById('save-empresa-config-btn').addEventListener('click', guardarEmpresaConfig);
    document.getElementById('propiedad-select').addEventListener('change', (e) => {
        if (e.target.value) {
            loadPropiedadWebsiteConfig(e.target.value);
        } else {
            document.getElementById('propiedad-config-section').classList.add('hidden');
            selectedPropiedadId = null;
        }
    });

    document.getElementById('generate-ai-description-btn').addEventListener('click', generarAIDescription);
    document.getElementById('save-propiedad-config-btn').addEventListener('click', savePropiedadWebsiteConfig);
    document.getElementById('hero-image-upload').addEventListener('change', handleHeroImageUpload); // Evento para la subida
}