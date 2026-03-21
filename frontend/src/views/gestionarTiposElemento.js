import { fetchAPI } from '../api.js';

let tipos = [];

async function cargarTipos() {
    try {
        tipos = await fetchAPI('/tipos-elemento');
        renderTabla();
    } catch (error) {
        console.error("Error al cargar tipos:", error);
        alert("Error al cargar los tipos de elemento.");
    }
}

// Helper para agrupar
function agruparPorCategoria(lista) {
    return lista.reduce((groups, item) => {
        const cat = item.categoria || 'Sin Categoría';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
        return groups;
    }, {});
}

function renderTabla(listaFiltrada = null) {
    const tbody = document.getElementById('tipos-tbody');
    if (!tbody) return;

    // Si no hay lista filtrada, usamos la global 'tipos'
    const lista = listaFiltrada || tipos;

    // Si está vacío
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-gray-400">No se encontraron activos.</td></tr>';
        return;
    }

    // Agrupar
    const grupos = agruparPorCategoria(lista);
    const categoriasOrdenadas = Object.keys(grupos).sort();

    let html = '';

    categoriasOrdenadas.forEach((cat, index) => {
        // ID de Grupo Robusto (Independiente del nombre)
        const groupId = `cat-group-${index}`;
        const count = grupos[cat].length;

        // HEADLINE CATEGORÍA (Collapsible)
        html += `
            <tr class="bg-gray-100 border-b cursor-pointer hover:bg-gray-200 transition-colors btn-toggle-categoria" data-target-group="${groupId}">
                <td colspan="7" class="p-2 pl-4 font-bold text-gray-700 uppercase text-xs tracking-wider">
                    <div class="flex items-center gap-2">
                        <svg style="transform: rotate(-180deg)" class="w-4 h-4 transform transition-transform duration-200 icon-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        <span>${cat}</span>
                        <span class="ml-auto bg-gray-300 text-gray-700 text-[10px] px-2 py-0.5 rounded-full">${count}</span>
                    </div>
                </td>
            </tr>
        `;

        // ITEMS DE LA CATEGORÍA
        // Ordenar items alfabéticamente dentro de la categoría
        const items = grupos[cat].sort((a, b) => a.nombre.localeCompare(b.nombre));

        items.forEach(t => {
            let iconToUse = t.icono;
            // Fallback Inteligente (Visual Only)
            if (!iconToUse || iconToUse === '❓') {
                const c = (t.categoria || '').toLowerCase();
                if (c.includes('dorm')) iconToUse = 'fa-bed';
                else if (c.includes('cocina')) iconToUse = 'fa-fire-burner';
                else if (c.includes('baño')) iconToUse = 'fa-bath';
                else if (c.includes('tech')) iconToUse = 'fa-wifi';
                else if (c.includes('liv') || c.includes('estar')) iconToUse = 'fa-couch';
                else iconToUse = 'fa-box';
            }

            const iconHtml = (iconToUse && iconToUse.startsWith('fa-'))
                ? `<i class="fa-solid ${iconToUse} text-xl text-primary-600"></i>`
                : `<span class="text-2xl">${iconToUse || '📦'}</span>`; // Bigger Emojis

            const seoInfo = t.seo_tags ? t.seo_tags.join(', ') : '';
            const photoInfo = t.photo_guidelines || '';

            // Add class for grouping
            html += `
            <tr class="border-b hover:bg-gray-50 align-top transition-colors group-item-${groupId} hidden">
                <td class="p-3 text-center w-12">${iconHtml}</td>
                <td class="p-3 pl-8"> <!-- Sankria (Indentation) -->
                    <div class="font-medium text-gray-900">${t.nombre}</div>
                </td>
                <td class="p-3 text-center text-sm font-bold text-gray-700">
                    ${t.capacity > 0 ? t.capacity : '-'}
                </td>
                <td class="p-3 text-center text-sm">
                    ${t.permiteCantidad ? '✅' : '-'}
                </td>
                <td class="p-3 text-center text-sm">
                    ${t.requires_photo ? `📷` : ''}
                </td>
                <td class="p-3 text-xs text-gray-500 max-w-xs">
                    ${seoInfo ? `<div>🏷️ ${seoInfo}</div>` : ''}
                    ${photoInfo ? `<div class="text-amber-700 mt-1">📸 ${photoInfo.substring(0, 40)}...</div>` : ''}
                </td>
                <td class="p-3 text-right whitespace-nowrap">
                    <button class="text-primary-600 hover:text-primary-800 edit-btn mr-3 font-medium transition-colors" data-id="${t.id}">
                        Editar
                    </button>
                    <button class="text-danger-500 hover:text-danger-700 delete-btn font-medium transition-colors" data-id="${t.id}">
                        Eliminar
                    </button>
                </td>
            </tr>
            `;
        });
    });

    tbody.innerHTML = html;

    // Re-attach events (Delete/Edit) - Same logic as before
    bindEvents(tbody);
}

function bindEvents(tbody) {
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('¿Estás seguro de eliminar este tipo?')) {
                try {
                    await fetchAPI(`/tipos-elemento/${e.target.dataset.id}`, { method: 'DELETE' });
                    await cargarTipos();
                } catch (error) {
                    alert(error.message);
                }
            }
        });
    });

    tbody.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            const data = tipos.find(t => t.id === id);
            if (!data) return;
            activarModoEdicion(data);
        });
    });
}

// Logic extracted to support search/edit triggering
function activarModoEdicion(data) {
    const form = document.getElementById('form-nuevo-tipo');
    const formContainer = document.getElementById('form-container');
    const btnNuevo = document.getElementById('btn-nuevo-tipo');
    const aiBanner = document.getElementById('ai-help-banner');
    const extendedFields = document.getElementById('extended-fields');

    // Populate Form
    form.elements['nombre'].value = data.nombre;
    if (form.elements['categoria']) form.elements['categoria'].value = data.categoria;
    form.elements['capacity'].value = data.capacity || 0;
    if (form.elements['icono']) form.elements['icono'].value = data.icono || '';
    if (form.elements['permiteCantidad']) {
        form.elements['permiteCantidad'].checked = data.permiteCantidad;
    }

    form.dataset.editId = data.id;
    document.getElementById('btn-submit').innerText = "💾 Guardar Cambios";

    formContainer.classList.remove('hidden');
    btnNuevo.classList.add('hidden');
    aiBanner.classList.add('hidden');
    extendedFields.classList.remove('hidden');
    extendedFields.classList.add('contents');
    formContainer.scrollIntoView({ behavior: 'smooth' });
}

export async function render() {
    try {
        tipos = await fetchAPI('/tipos-elemento');
    } catch (error) { console.error(error); }

    // Categories calculation (Same as before)
    const estandar = ['Dormitorio', 'Cocina', 'Living', 'Comedor', 'Exterior', 'Baño', 'Tecnología', 'Servicios', 'Otros'];
    const categoriasDB = tipos.map(t => t.categoria).filter(Boolean);
    const unicas = new Set([...categoriasDB, ...estandar].map(c => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()));
    const categoriasUnicas = [...unicas].sort();
    const datalistOptions = categoriasUnicas.map(c => `<option value="${c}">${c}</option>`).join('');

    return `
        <div class="bg-white p-8 rounded-lg shadow min-h-screen">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">Biblioteca de Activos</h2>
                    <p class="text-gray-500 text-sm mt-1">Inventario maestro de amenidades.</p>
                </div>
                <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <!-- SEARCH BAR -->
                    <div class="relative">
                        <input type="text" id="filtro-activos" placeholder="🔍 Buscar activo o categoría..." 
                            class="form-input pl-8 pr-4 py-2 w-full sm:w-64 text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500">
                    </div>
                    <button id="btn-nuevo-tipo" class="btn-primary whitespace-nowrap">+ Nuevo Tipo</button>
                </div>
            </div>

            <!-- FORMULARIO -->
            <div id="form-container" class="hidden bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8 shadow-sm transition-all duration-300">
                <div id="ai-help-banner" class="hidden mb-4 p-3 bg-primary-50 text-primary-800 text-sm rounded border border-primary-200 flex items-center">
                    <span class="mr-2 text-xl">🤖</span>
                    <div>
                        <strong>Ayuda requerida:</strong>
                        <span id="ai-help-text">Confirma los datos sugeridos.</span>
                    </div>
                </div>

                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-gray-800">Definir Nuevo Activo</h3>
                    <button type="button" id="btn-cancelar" class="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                
                <form id="form-nuevo-tipo" class="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                    <div class="md:col-span-2">
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Nombre del Activo</label>
                        <input type="text" name="nombre" required placeholder="Ej: Jacuzzi Exterior" class="form-input w-full shadow-sm text-gray-900">
                        <p class="text-xs text-gray-500 mt-1">Escribe lo que quieras. El sistema intentará clasificarlo automáticamente.</p>
                    </div>

                    <!-- Extended Fields -->
                    <div id="extended-fields" class="contents hidden">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Categoría</label>
                            <select name="categoria" class="form-select w-full border-gray-300 rounded-md shadow-sm">
                                <option value="" selected>Auto (Recomendado)</option>
                                ${datalistOptions}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Icono (Emoji)</label>
                            <!-- UX FIX: Smaller font for input, clear helper text below -->
                            <input type="text" name="icono" placeholder="Ej: 🍳" class="form-input w-full text-center text-2xl h-10">
                            <p class="text-xs text-gray-500 mt-1 text-center">
                                Usa <kbd class="px-1 py-0.5 rounded bg-gray-200 border border-gray-300 font-sans text-xs">Win</kbd> + <kbd class="px-1 py-0.5 rounded bg-gray-200 border border-gray-300 font-sans text-xs">.</kbd> para emojis.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-1">Capacidad</label>
                        <input type="number" name="capacity" min="0" placeholder="0" class="form-input w-full h-10">
                    </div>

                    <div class="flex items-center pt-8">
                         <label class="flex items-center space-x-2 text-sm cursor-pointer select-none">
                            <input type="checkbox" name="permiteCantidad" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4">
                            <span>¿Es Multi-cantidad?</span>
                        </label>
                    </div>
                    
                    <div class="md:col-span-4 flex justify-end gap-3 mt-2 pt-4 border-t border-gray-200">
                        <button type="submit" class="btn-primary w-full md:w-48 shadow-lg transform transition hover:scale-105" id="btn-submit">
                           ✨ Guardar
                        </button>
                    </div>
                </form>
            </div>

            <!-- TABLE -->
            <div class="overflow-hidden rounded-lg border border-gray-200">
                <table class="w-full text-left border-collapse bg-white">
                    <thead>
                        <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                            <th class="p-4 text-center w-16">Icon</th>
                            <th class="p-4 pl-8">Activo</th>
                            <th class="p-4 text-center">Pax</th>
                            <th class="p-4 text-center">Multi</th>
                            <th class="p-4 text-center">Foto?</th>
                            <th class="p-4">Info Extra</th>
                            <th class="p-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tipos-tbody" class="divide-y divide-gray-100">
                        <!-- Content rendered by JS -->
                    </tbody>
                </table>
            </div>
        </div >
            `;
}

export function afterRender() {
    renderTabla();

    // COLLAPSE HANDLER (Delegation)
    const tbody = document.getElementById('tipos-tbody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.btn-toggle-categoria');
            if (toggleBtn) {
                const targetGroup = toggleBtn.dataset.targetGroup;
                const rows = document.querySelectorAll(`.group-item-${targetGroup}`);

                if (rows.length === 0) return;

                const isHidden = rows[0].classList.contains('hidden');

                rows.forEach(r => {
                    if (isHidden) r.classList.remove('hidden');
                    else r.classList.add('hidden');
                });

                const chevron = toggleBtn.querySelector('.icon-chevron');
                if (chevron) {
                    chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-180deg)';
                }
            }
        });
    }

    const formContainer = document.getElementById('form-container');
    const aiBanner = document.getElementById('ai-help-banner');
    const btnNuevo = document.getElementById('btn-nuevo-tipo');
    const btnCancelar = document.getElementById('btn-cancelar');
    const form = document.getElementById('form-nuevo-tipo');
    const extendedFields = document.getElementById('extended-fields');

    // CREATE Mode
    btnNuevo.addEventListener('click', () => {
        formContainer.classList.remove('hidden');
        btnNuevo.classList.add('hidden');
        aiBanner.classList.add('hidden');

        // Hide extended fields for clean creation
        extendedFields.classList.add('hidden');
        extendedFields.classList.remove('contents');

        form.reset();
        delete form.dataset.editId;
        delete form.dataset.forceCreation;
        document.getElementById('btn-submit').innerText = "✨ Guardar";
    });

    btnCancelar.addEventListener('click', () => {
        formContainer.classList.add('hidden');
        btnNuevo.classList.remove('hidden');
        form.reset();
        delete form.dataset.editId;
        aiBanner.classList.add('hidden');
    });

    // SEARCH LOGIC
    const searchInput = document.getElementById('filtro-activos');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderTabla(tipos);
            } else {
                const filtered = tipos.filter(t =>
                    t.nombre.toLowerCase().includes(query) ||
                    (t.categoria || '').toLowerCase().includes(query)
                );
                renderTabla(filtered);
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSubmit = document.getElementById('btn-submit');
        const originalText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '🤖 Analizando...';

        const formData = new FormData(form);
        const isCountable = formData.get('permiteCantidad') === 'on';
        const datos = {
            nombre: formData.get('nombre'),
            categoria: formData.get('categoria'),
            icono: formData.get('icono'),
            capacity: Number(formData.get('capacity') || 0),
            permiteCantidad: isCountable,
            countable: isCountable
        };

        const editId = form.dataset.editId;

        try {
            if (editId) {
                // UPDATE MODE
                await fetchAPI(`/tipos-elemento/${editId}`, {
                    method: 'PUT',
                    body: datos
                });
                alert('Tipo actualizado correctamente ✨');
            } else {
                // CREATE MODE
                await fetchAPI('/tipos-elemento', {
                    method: 'POST',
                    body: { ...datos, force_creation: form.dataset.forceCreation === 'true' }
                });
                alert('Tipo creado exitosamente ✨');
            }

            form.reset();
            delete form.dataset.editId;
            delete form.dataset.forceCreation;

            formContainer.classList.add('hidden');
            btnNuevo.classList.remove('hidden');
            aiBanner.classList.add('hidden');
            btnSubmit.innerHTML = "✨ Guardar";

            // Recargar tabla
            tipos = await fetchAPI('/tipos-elemento');
            renderTabla();

        } catch (error) {
            // HUMAN-IN-THE-LOOP: AI Ambiguity Handler (ONLY FOR CREATION)
            if (!editId && error.status === 422 && error.responseJSON?.action_required === 'manual_classification') {
                const aiData = error.responseJSON.ai_result;

                // Mostrar Banner de Ayuda
                aiBanner.classList.remove('hidden');
                document.getElementById('ai-help-text').innerText = "La IA tiene dudas. Confirma o corrige los datos y vuelve a Guardar.";

                // Pre-llenar campos con la sugerencia de la IA
                if (form.elements['categoria']) form.elements['categoria'].value = aiData.category || '';
                if (form.elements['capacity']) form.elements['capacity'].value = aiData.capacity || 0;
                if (form.elements['icono']) form.elements['icono'].value = aiData.icon || '';
                if (form.elements['permiteCantidad']) form.elements['permiteCantidad'].checked = aiData.countable;

                // SHOW EXTENDED FIELDS FOR MANUAL CORRECTION
                extendedFields.classList.remove('hidden');
                extendedFields.classList.add('contents');

                // Activar modo "Forzar Creación" para el próximo intento
                form.dataset.forceCreation = 'true';
                btnSubmit.innerText = "💾 Confirmar Manualmente";

                // Highlight visual
                formContainer.classList.add('border-orange-500', 'ring-2', 'ring-orange-100');
                setTimeout(() => formContainer.classList.remove('border-orange-500', 'ring-2', 'ring-orange-100'), 2000);

            } else {
                console.error(error);
                alert(error.message || 'Error al guardar.');
                btnSubmit.innerHTML = originalText;
            }
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                if (!form.dataset.forceCreation && !form.dataset.editId) {
                    btnSubmit.innerHTML = "✨ Guardar";
                }
            }
        }
    });
}
