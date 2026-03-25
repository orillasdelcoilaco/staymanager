// frontend/src/views/gestionarBloqueos.js
// Gestión de bloqueos de alojamientos (mantenimiento, cierre temporal, etc.)

import { fetchAPI } from '../api.js';

export function render() {
    return `
<div class="max-w-3xl mx-auto py-8 px-4">
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Bloqueos de Alojamientos</h1>
        <p class="text-sm text-gray-500 mt-1">Bloquea fechas por mantenimiento o cierre temporal. Los días bloqueados aparecen en gris en el calendario, se publican en iCal y se descuentan de las noches disponibles en los KPI.</p>
    </div>

    <!-- Formulario nuevo bloqueo -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 class="font-semibold text-gray-800 mb-4">Nuevo bloqueo</h2>

        <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-medium text-gray-700">Alojamientos</label>
                <label class="flex items-center gap-2 text-sm text-primary-600 cursor-pointer select-none">
                    <input type="checkbox" id="chk-todos" class="rounded">
                    Seleccionar todos
                </label>
            </div>
            <div id="lista-alojamientos" class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 border border-gray-200 rounded-lg bg-gray-50">
                <p class="text-xs text-gray-400 col-span-full">Cargando…</p>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                <input type="date" id="fecha-inicio" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                <input type="date" id="fecha-fin" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            </div>
        </div>

        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
            <input type="text" id="motivo" placeholder="Ej: Mantenimiento general, reparación de tinaja…"
                   class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
        </div>

        <div id="form-error" class="hidden mb-3 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700"></div>

        <div class="flex justify-end">
            <button id="btn-crear" class="btn-primary">Crear bloqueo</button>
        </div>
    </div>

    <!-- Lista de bloqueos existentes -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h2 class="font-semibold text-gray-800 mb-4">Bloqueos activos y pasados</h2>
        <div id="lista-bloqueos">
            <p class="text-sm text-gray-400">Cargando…</p>
        </div>
    </div>
</div>`;
}

function mostrarError(msg) {
    const el = document.getElementById('form-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

async function cargarAlojamientos() {
    const listaAloj = document.getElementById('lista-alojamientos');
    try {
        const alojamientos = await fetchAPI('/propiedades');
        listaAloj.innerHTML = alojamientos.map(a => `
            <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" class="chk-aloj rounded" value="${a.id}">
                <span>${a.nombre}</span>
            </label>`).join('');
        return alojamientos;
    } catch {
        listaAloj.innerHTML = '<p class="text-xs text-danger-500 col-span-full">Error al cargar alojamientos.</p>';
        return [];
    }
}

function configurarSeleccionTodos() {
    const chkTodos  = document.getElementById('chk-todos');
    const listaAloj = document.getElementById('lista-alojamientos');
    chkTodos.addEventListener('change', () => {
        document.querySelectorAll('.chk-aloj').forEach(c => c.checked = chkTodos.checked);
    });
    listaAloj.addEventListener('change', () => {
        const total    = document.querySelectorAll('.chk-aloj').length;
        const marcados = document.querySelectorAll('.chk-aloj:checked').length;
        chkTodos.checked = total > 0 && marcados === total;
    });
}

async function cargarBloqueos(alojamientos) {
    const contenedor = document.getElementById('lista-bloqueos');
    try {
        const bloqueos = await fetchAPI('/bloqueos');
        if (bloqueos.length === 0) {
            contenedor.innerHTML = '<p class="text-sm text-gray-400">No hay bloqueos registrados.</p>';
            return;
        }

        const alojMap = Object.fromEntries(alojamientos.map(a => [a.id, a.nombre]));
        const fmt = iso => new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        const hoyISO = new Date().toISOString().split('T')[0];

        contenedor.innerHTML = `
            <div class="space-y-3">
                ${bloqueos.map(b => {
                    const nombres  = b.todos
                        ? 'Todos los alojamientos'
                        : (b.alojamientoIds || []).map(id => alojMap[id] || id).join(', ');
                    const esPasado = b.fechaFin < hoyISO;
                    return `
                    <div class="flex items-start gap-4 p-4 rounded-lg border ${esPasado ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-warning-200 bg-warning-50'}">
                        <span class="text-xl mt-0.5">🔒</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-gray-800">${b.motivo || 'Sin motivo especificado'}</p>
                            <p class="text-xs text-gray-500 mt-0.5">${nombres}</p>
                            <p class="text-xs text-gray-400 mt-1">${fmt(b.fechaInicio)} → ${fmt(b.fechaFin)}</p>
                        </div>
                        <button class="btn-danger btn-sm text-xs px-3 py-1" data-id="${b.id}">Eliminar</button>
                    </div>`;
                }).join('')}
            </div>`;

        contenedor.querySelectorAll('[data-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('¿Eliminar este bloqueo?')) return;
                btn.disabled = true;
                try {
                    await fetchAPI(`/bloqueos/${btn.dataset.id}`, { method: 'DELETE' });
                    await cargarBloqueos(alojamientos);
                } catch (err) {
                    alert(`Error: ${err.message}`);
                    btn.disabled = false;
                }
            });
        });
    } catch {
        contenedor.innerHTML = '<p class="text-sm text-danger-500">Error al cargar bloqueos.</p>';
    }
}

function attachCrearBloqueo(alojamientos) {
    document.getElementById('btn-crear').addEventListener('click', async () => {
        document.getElementById('form-error').classList.add('hidden');

        const chkTodos       = document.getElementById('chk-todos');
        const fechaInicio    = document.getElementById('fecha-inicio');
        const fechaFin       = document.getElementById('fecha-fin');
        const motivoInput    = document.getElementById('motivo');
        const todos          = chkTodos.checked;
        const alojamientoIds = [...document.querySelectorAll('.chk-aloj:checked')].map(c => c.value);

        if (!todos && alojamientoIds.length === 0) { mostrarError('Selecciona al menos un alojamiento.'); return; }
        if (!fechaInicio.value || !fechaFin.value)  { mostrarError('Completa las fechas de inicio y fin.'); return; }
        if (fechaFin.value < fechaInicio.value)      { mostrarError('La fecha de fin debe ser igual o posterior a la fecha de inicio.'); return; }

        const btn = document.getElementById('btn-crear');
        btn.disabled = true;
        btn.textContent = 'Creando…';
        try {
            await fetchAPI('/bloqueos', {
                method: 'POST',
                body: { todos, alojamientoIds, fechaInicio: fechaInicio.value, fechaFin: fechaFin.value, motivo: motivoInput.value.trim() }
            });
            motivoInput.value = '';
            document.querySelectorAll('.chk-aloj').forEach(c => c.checked = false);
            chkTodos.checked = false;
            await cargarBloqueos(alojamientos);
        } catch (err) {
            mostrarError(err.message);
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Crear bloqueo';
        }
    });
}

export async function afterRender() {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fecha-inicio').value = hoy;
    document.getElementById('fecha-fin').value    = hoy;

    const alojamientos = await cargarAlojamientos();
    configurarSeleccionTodos();
    attachCrearBloqueo(alojamientos);
    await cargarBloqueos(alojamientos);
}
