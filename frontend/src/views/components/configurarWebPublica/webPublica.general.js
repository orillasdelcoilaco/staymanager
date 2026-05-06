// frontend/src/views/components/configurarWebPublica/webPublica.general.js
// Formulario único para configuración web pública - Sin wizard
import { fetchAPI } from '../../../api.js';
import { renderUnified, setupUnifiedEvents } from './webPublica.general.unified.js';

let _fullEmpresaData = {};

function setupMaintenanceToolsOnce() {
    const btn = document.getElementById('btn-regenerate-web-images');
    const statusEl = document.getElementById('repair-web-images-status');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', async () => {
        const force = document.getElementById('repair-force-all')?.checked === true;
        const rawPid = (document.getElementById('repair-propiedad-id')?.value || '').trim();
        if (!confirm(
            'Se regenerarán las miniaturas WebP de la galería, imagen de tarjeta y banner. '
            + 'Si alguna imagen completa no está disponible, la entrada puede eliminarse. '
            + 'Puede tardar varios minutos. ¿Continuar?'
        )) return;

        btn.disabled = true;
        if (statusEl) {
            statusEl.classList.remove('hidden', 'text-danger-600', 'text-success-700');
            statusEl.classList.add('text-gray-600');
            statusEl.textContent = 'Ejecutando… no cierres esta pestaña.';
        }

        try {
            const payload = { force };
            if (rawPid) payload.propiedadId = rawPid;
            const result = await fetchAPI('/website/maintenance/regenerate-web-images', {
                method: 'POST',
                body: payload,
            });
            const g = result.gallery || {};
            const c = result.cardImage || {};
            const h = result.hero || {};
            const msg = [
                `Galería: ${g.repaired ?? 0} regeneradas, ${g.deleted ?? 0} eliminadas, ${g.skipped ?? 0} omitidas (total filas ${g.total ?? 0}).`,
                `Tarjetas: ${c.thumbsNew ?? 0} miniaturas nuevas, ${c.removed ?? 0} quitadas.`,
                `Hero: ${h.updated ? 'miniatura actualizada' : 'sin cambios'}.`,
            ].join('\n');
            if (statusEl) {
                statusEl.classList.remove('text-gray-600');
                statusEl.classList.add('text-success-700');
                statusEl.textContent = msg;
            }
            alert(msg);
        } catch (e) {
            if (statusEl) {
                statusEl.classList.remove('text-gray-600');
                statusEl.classList.add('text-danger-600');
                statusEl.textContent = e.message || 'Error';
            }
            alert(e.message || 'Error');
        } finally {
            btn.disabled = false;
        }
    });
}

function _render(empresaData = _fullEmpresaData) {
    const container = document.getElementById('general-settings-form');
    if (!container) return;

    // Usar los datos proporcionados o los globales
    const datosParaRender = empresaData || _fullEmpresaData;

    // Siempre mostrar el formulario unificado
    container.innerHTML = renderUnified(datosParaRender);

    // El callback onComplete se pasa a setupUnifiedEvents
    // Recibe los datos actualizados directamente del backend
    setupUnifiedEvents(datosParaRender, async (responseHomeSettings, responseEmpresa) => {
        console.log('📥 Callback onComplete ejecutado con respuestas:', {
            homeSettings: responseHomeSettings,
            empresa: responseEmpresa
        });

        // Usar los datos actualizados que YA devolvió el backend
        let datosActualizados = null;

        if (responseHomeSettings?.empresa) {
            console.log('✅ Usando datos de responseHomeSettings.empresa');
            datosActualizados = responseHomeSettings.empresa;
        } else if (responseEmpresa?.empresa) {
            console.log('✅ Usando datos de responseEmpresa.empresa');
            datosActualizados = responseEmpresa.empresa;
        } else if (responseHomeSettings?.websiteSettings) {
            console.log('⚠️ Solo websiteSettings disponible, combinando con datos existentes');
            datosActualizados = { ...datosParaRender, websiteSettings: responseHomeSettings.websiteSettings };
        } else {
            console.warn('⚠️ No hay datos actualizados en las respuestas, haciendo fetch...');
            try {
                datosActualizados = await fetchAPI('/empresa');
            } catch (error) {
                console.error('Error haciendo fetch:', error);
            }
        }

        if (datosActualizados && datosActualizados.id) {
            console.log('🔄 Actualizando datos globales y re-renderizando...');
            _fullEmpresaData = datosActualizados;
            _render(datosActualizados);

            // Mostrar mensaje de éxito
            const subdomain = datosActualizados.websiteSettings?.general?.subdomain ||
                             datosActualizados.subdominio ||
                             '(no especificado)';
            alert(`✅ Configuración guardada exitosamente.

📊 Datos actualizados:
• Subdominio: ${subdomain}
• Dominio: ${datosActualizados.websiteSettings?.general?.domain || datosActualizados.dominio || '(no especificado)'}
• WhatsApp: ${datosActualizados.websiteSettings?.general?.whatsapp || '(no especificado)'}

Los datos se han actualizado en pantalla.`);
        } else {
            console.error('❌ No se pudieron obtener datos actualizados');
            alert('✅ Configuración guardada, pero no se pudieron actualizar los datos en pantalla. Recarga la página.');
        }
    });
}

export function renderGeneral(empresaData) {
    _fullEmpresaData = empresaData || {};
    return `
    <div class="space-y-10">
        <div id="general-settings-form"></div>
        <section class="rounded-xl border border-gray-200 bg-gray-50 p-6" aria-labelledby="website-maint-heading">
            <h3 id="website-maint-heading" class="text-lg font-semibold text-gray-900 mb-2">Herramientas del sitio público</h3>
            <p class="text-sm text-gray-600 mb-4">
                Regenera miniaturas WebP desde las imágenes en almacenamiento (galería, foto principal de cada alojamiento y banner).
                La empresa es siempre la de tu sesión. Puede tardar varios minutos.
            </p>
            <div class="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
                <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" id="repair-force-all" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    Forzar todas las miniaturas (aunque parezcan correctas)
                </label>
                <div class="flex-1 min-w-[200px]">
                    <label for="repair-propiedad-id" class="block text-xs font-medium text-gray-600 mb-1">Solo un alojamiento (opcional, ID interno)</label>
                    <input type="text" id="repair-propiedad-id" placeholder="ej. cabana-1" autocomplete="off"
                           class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
            </div>
            <button type="button" id="btn-regenerate-web-images" class="btn-primary px-4 py-2 rounded-lg text-sm font-semibold">
                Regenerar miniaturas web
            </button>
            <p id="repair-web-images-status" class="mt-3 text-sm whitespace-pre-line hidden" role="status"></p>
        </section>
    </div>`;
}

export function setupGeneralEvents() {
    _render(_fullEmpresaData);
    setupMaintenanceToolsOnce();
}
