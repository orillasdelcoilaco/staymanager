import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let cliente = null;
let reservaDeOrigenId = null; 

function renderStars(rating) {
    const filledStar = '⭐';
    const emptyStar = '☆';
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? filledStar : emptyStar;
    }
    return stars || 'Sin calificar';
}

function abrirModalEditar() {
    const modal = document.getElementById('cliente-modal-perfil');
    const form = document.getElementById('cliente-form-perfil');
    if (!modal || !form || !cliente) return;
    
    form.nombre.value = cliente.nombre || '';
    form.email.value = cliente.email || '';
    form.telefono.value = cliente.telefono || '';
    form.pais.value = cliente.pais || '';
    form.calificacion.value = cliente.calificacion || 0;
    form.ubicacion.value = cliente.ubicacion || '';
    form.notas.value = cliente.notas || '';
    
    modal.classList.remove('hidden');
}

function cerrarModalEditar() {
    document.getElementById('cliente-modal-perfil').classList.add('hidden');
}

function renderHistorialReservas() {
    const tbody = document.getElementById('historial-tbody');
    if (!tbody || !cliente || !cliente.reservas || cliente.reservas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-4">No hay reservas para este cliente.</td></tr>';
        return;
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-CL', { timeZone: 'UTC' });
    };

    const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

    tbody.innerHTML = cliente.reservas.map(r => `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3">${r.idReservaCanal}</td>
            <td class="py-2 px-3">${r.alojamientoNombre}</td>
            <td class="py-2 px-3">${r.canalNombre}</td>
            <td class="py-2 px-3">${formatDate(r.fechaLlegada)}</td>
            <td class="py-2 px-3">${r.totalNoches}</td>
            <td class="py-2 px-3">${r.estado}</td>
            <td class="py-2 px-3 font-semibold">${formatCurrency(r.valores.valorHuesped)}</td>
        </tr>
    `).join('');
}

export async function render() {
    const pathParts = window.location.pathname.split('/');
    const clienteId = pathParts[pathParts.length - 1];
    
    const urlParams = new URLSearchParams(window.location.search);
    reservaDeOrigenId = urlParams.get('from-reserva');

    try {
        cliente = await fetchAPI(`/clientes/${clienteId}`);
    } catch (error) {
        return `<p class="text-red-500">Error al cargar el perfil del cliente: ${error.message}</p>`;
    }

    const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

    return `
        <div class="bg-white p-8 rounded-lg shadow mb-8">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">${cliente.nombre}</h2>
                    <div class="flex items-center gap-4 mt-1">
                        <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">${cliente.tipoCliente} (${cliente.numeroDeReservas})</span>
                        <span class="text-sm text-gray-600">${cliente.email || ''}</span>
                        <span class="text-sm text-gray-600">${cliente.telefono || ''} - ${cliente.pais || 'País no especificado'}</span>
                    </div>
                </div>
                <div>
                    <button id="edit-cliente-btn" class="btn-primary mr-2">Editar Cliente</button>
                    <button id="back-btn" class="btn-secondary">Volver</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-6">
                <div class="md:col-span-1">
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Datos Adicionales</h3>
                    <dl>
                        <dt class="font-medium text-gray-600 text-sm">Valor Histórico Total</dt>
                        <dd class="text-green-600 text-xl font-bold mb-3">${formatCurrency(cliente.totalGastado)}</dd>

                        <dt class="font-medium text-gray-600 text-sm">Calificación</dt>
                        <dd class="text-yellow-500 text-xl mb-3">${renderStars(cliente.calificacion)}</dd>
                        
                        <dt class="font-medium text-gray-600 text-sm">Ubicación Geográfica</dt>
                        <dd class="text-gray-800 text-sm">${cliente.ubicacion || 'No especificada'}</dd>
                    </dl>
                </div>
                <div class="md:col-span-2">
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Notas</h3>
                    <div class="bg-gray-50 p-3 rounded-md text-sm text-gray-700 whitespace-pre-wrap h-40 overflow-y-auto">
                        ${cliente.notas || 'Sin notas.'}
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-white p-8 rounded-lg shadow">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">Historial de Reservas</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th text-xs py-2 px-3">ID Canal</th>
                            <th class="th text-xs py-2 px-3">Alojamiento</th>
                            <th class="th text-xs py-2 px-3">Canal</th>
                            <th class="th text-xs py-2 px-3">Check-in</th>
                            <th class="th text-xs py-2 px-3">Noches</th>
                            <th class="th text-xs py-2 px-3">Estado</th>
                            <th class="th text-xs py-2 px-3">Total Cliente</th>
                        </tr>
                    </thead>
                    <tbody id="historial-tbody"></tbody>
                </table>
            </div>
        </div>
        
        <div id="cliente-modal-perfil" class="modal hidden">
            <div class="modal-content">
                <h3 class="text-xl font-semibold mb-4">Editar Cliente</h3>
                <form id="cliente-form-perfil">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="mb-2"><label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Completo</label><input type="text" name="nombre" required class="mt-1 form-input"></div>
                        <div class="mb-2"><label for="telefono" class="block text-sm font-medium text-gray-700">Teléfono</label><input type="tel" name="telefono" required class="mt-1 form-input"></div>
                        <div class="mb-2"><label for="email" class="block text-sm font-medium text-gray-700">Email</label><input type="email" name="email" class="mt-1 form-input"></div>
                        <div class="mb-2"><label for="pais" class="block text-sm font-medium text-gray-700">País</label><input type="text" name="pais" class="mt-1 form-input"></div>
                    </div>
                    <hr class="my-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="mb-2"><label for="calificacion" class="block text-sm font-medium text-gray-700">Calificación</label><select name="calificacion" class="mt-1 form-select"><option value="0">Sin calificar</option><option value="1">⭐</option><option value="2">⭐⭐</option><option value="3">⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="5">⭐⭐⭐⭐⭐</option></select></div>
                        <div class="mb-2"><label for="ubicacion" class="block text-sm font-medium text-gray-700">Ubicación</label><input type="text" name="ubicacion" class="mt-1 form-input"></div>
                    </div>
                    <div class="mb-2"><label for="notas" class="block text-sm font-medium text-gray-700">Notas</label><textarea name="notas" rows="3" class="mt-1 form-input"></textarea></div>
                    <div class="flex justify-end pt-4 mt-4 border-t">
                        <button type="button" id="cancel-btn-perfil" class="btn-secondary mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

export function afterRender() {
    renderHistorialReservas();

    const backBtn = document.getElementById('back-btn');
    backBtn.textContent = reservaDeOrigenId ? 'Volver a Gestión Diaria' : 'Volver a Clientes';
    backBtn.addEventListener('click', () => {
        const path = reservaDeOrigenId ? '/gestion-diaria' : '/clientes';
        handleNavigation(path);
    });

    document.getElementById('edit-cliente-btn').addEventListener('click', abrirModalEditar);
    document.getElementById('cancel-btn-perfil').addEventListener('click', cerrarModalEditar);

    document.getElementById('cliente-form-perfil').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';

        const datos = {
            nombre: form.nombre.value,
            telefono: form.telefono.value,
            email: form.email.value,
            pais: form.pais.value,
            calificacion: parseInt(form.calificacion.value) || 0,
            ubicacion: form.ubicacion.value,
            notas: form.notas.value
        };

        try {
            await fetchAPI(`/clientes/${cliente.id}`, { method: 'PUT', body: datos });
            
            if (reservaDeOrigenId) {
                await fetchAPI('/gestion/marcar-cliente-gestionado', {
                    method: 'POST',
                    body: { reservaIdOriginal: reservaDeOrigenId }
                });
                handleNavigation('/gestion-diaria');
            } else {
                cliente = { ...cliente, ...datos };
                cerrarModalEditar();
                handleNavigation(window.location.pathname);
            }

        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
}