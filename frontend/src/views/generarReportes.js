// frontend/src/views/generarReportes.js

import { fetchAPI } from '../api.js';

let plantillasDisponibles = {
    actividad: null,
    disponibilidad: null
};

async function fetchPlantillas() {
    try {
        const [plantillas, tipos] = await Promise.all([
            fetchAPI('/plantillas'),
            fetchAPI('/plantillas/tipos')
        ]);
        
        const tipoActividad = tipos.find(t => t.nombre.toLowerCase().includes('actividad'));
        const tipoDisponibilidad = tipos.find(t => t.nombre.toLowerCase().includes('disponibilidad'));

        if (tipoActividad) {
            plantillasDisponibles.actividad = plantillas.find(p => p.tipoId === tipoActividad.id);
        }
        if (tipoDisponibilidad) {
            plantillasDisponibles.disponibilidad = plantillas.find(p => p.tipoId === tipoDisponibilidad.id);
        }

    } catch (error) {
        console.error("Error cargando plantillas para reportes:", error);
    }
}


export async function render() {
    return `
        <div class="space-y-8">
            <div class="bg-white p-8 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">Generador de Reportes Rápidos</h2>
                <p class="text-gray-600 mb-6">Genera textos listos para copiar y pegar en WhatsApp sobre la actividad diaria o la disponibilidad futura.</p>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    <div class="border rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">Reporte de Actividad Diaria</h3>
                        <div class="flex items-end space-x-4">
                            <div class="flex-grow">
                                <label for="fecha-diaria" class="block text-sm font-medium text-gray-700">Selecciona una fecha</label>
                                <input type="date" id="fecha-diaria" class="mt-1 form-input">
                            </div>
                            <button id="btn-generar-diario" class="btn-primary">Generar</button>
                        </div>
                        <div id="reporte-diario-container" class="mt-4 hidden">
                            <textarea id="reporte-diario-box" rows="12" class="form-input bg-gray-50 font-mono text-xs"></textarea>
                            <button id="btn-copiar-diario" class="mt-2 btn-secondary">Copiar Reporte</button>
                        </div>
                    </div>

                    <div class="border rounded-lg p-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">Reporte de Disponibilidad</h3>
                        <div class="flex items-end space-x-4">
                            <div class="flex-grow">
                                <label for="fecha-disponibilidad-inicio" class="block text-sm font-medium">Desde</label>
                                <input type="date" id="fecha-disponibilidad-inicio" class="mt-1 form-input">
                            </div>
                            <div class="flex-grow">
                                <label for="fecha-disponibilidad-fin" class="block text-sm font-medium">Hasta</label>
                                <input type="date" id="fecha-disponibilidad-fin" class="mt-1 form-input">
                            </div>
                            <button id="btn-generar-disponibilidad" class="btn-primary">Generar</button>
                        </div>
                        <div id="reporte-disponibilidad-container" class="mt-4 hidden">
                            <textarea id="reporte-disponibilidad-box" rows="12" class="form-input bg-gray-50 font-mono text-xs"></textarea>
                            <button id="btn-copiar-disponibilidad" class="mt-2 btn-secondary">Copiar Reporte</button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    await fetchPlantillas();

    // --- Lógica para Reporte Diario ---
    const btnGenerarDiario = document.getElementById('btn-generar-diario');
    const containerDiario = document.getElementById('reporte-diario-container');
    const boxDiario = document.getElementById('reporte-diario-box');

    btnGenerarDiario.addEventListener('click', async () => {
        const fecha = document.getElementById('fecha-diaria').value;
        if (!fecha) { alert('Por favor, selecciona una fecha.'); return; }
        
        if (!plantillasDisponibles.actividad) {
            alert('No se encontró una plantilla de tipo "Actividad". Por favor, crea una en la sección de plantillas.');
            return;
        }

        boxDiario.value = 'Generando...';
        containerDiario.classList.remove('hidden');
        btnGenerarDiario.disabled = true;

        try {
            const result = await fetchAPI('/mensajes/preparar-reporte', {
                method: 'POST',
                body: { tipoReporte: 'actividad_diaria', datos: { fecha } }
            });
            boxDiario.value = result.texto;
        } catch (error) {
            boxDiario.value = `Error al generar el reporte: ${error.message}`;
        } finally {
            btnGenerarDiario.disabled = false;
        }
    });

    document.getElementById('btn-copiar-diario').addEventListener('click', () => {
        navigator.clipboard.writeText(boxDiario.value);
    });

    // --- Lógica para Reporte de Disponibilidad ---
    const btnGenerarDisponibilidad = document.getElementById('btn-generar-disponibilidad');
    const containerDisponibilidad = document.getElementById('reporte-disponibilidad-container');
    const boxDisponibilidad = document.getElementById('reporte-disponibilidad-box');

    btnGenerarDisponibilidad.addEventListener('click', async () => {
        const fechaInicio = document.getElementById('fecha-disponibilidad-inicio').value;
        const fechaFin = document.getElementById('fecha-disponibilidad-fin').value;
        if (!fechaInicio || !fechaFin) { alert('Por favor, selecciona ambas fechas.'); return; }

        if (!plantillasDisponibles.disponibilidad) {
            alert('No se encontró una plantilla de tipo "Disponibilidad". Por favor, crea una en la sección de plantillas.');
            return;
        }

        boxDisponibilidad.value = 'Generando...';
        containerDisponibilidad.classList.remove('hidden');
        btnGenerarDisponibilidad.disabled = true;

        try {
            const result = await fetchAPI('/mensajes/preparar-reporte', {
                method: 'POST',
                body: { tipoReporte: 'disponibilidad', datos: { fechaInicio, fechaFin } }
            });
            boxDisponibilidad.value = result.texto;
        } catch (error) {
            boxDisponibilidad.value = `Error al generar el reporte: ${error.message}`;
        } finally {
            btnGenerarDisponibilidad.disabled = false;
        }
    });

    document.getElementById('btn-copiar-disponibilidad').addEventListener('click', () => {
        navigator.clipboard.writeText(boxDisponibilidad.value);
    });
}