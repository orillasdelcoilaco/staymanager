// frontend/src/views/gestionarComentarios.js

import { fetchAPI } from '../api.js';
import { renderComentariosTabla } from './components/gestionarComentarios/tabla.js';
import { 
    handleSearchFormSubmit, 
    handleNewCommentFormSubmit, 
    handleDeleteCommentClick,
    poblarSelectCanales,
    setupSearchResultsListener
} from './components/gestionarComentarios/utils.js';

let comentarios = [];
let canales = [];

export async function render() {
    // Cargar datos iniciales
    try {
        [comentarios, canales] = await Promise.all([
            fetchAPI('/comentarios'),
            fetchAPI('/canales')
        ]);
    } catch (error) {
        console.error("Error al cargar datos para Comentarios:", error);
        return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }

    return `
        <div class="bg-white p-6 rounded-lg shadow mb-8">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">1. Buscar Reserva para Vincular</h2>
            <form id="form-buscar-reserva" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label for="canal-select" class="block text-sm font-medium text-gray-700">Canal</label>
                    <select id="canal-select" class="form-input mt-1"></select>
                </div>
                <div>
                    <label for="termino-busqueda" class="block text-sm font-medium text-gray-700">ID Reserva o Nombre</label>
                    <input type="text" id="termino-busqueda" placeholder="Ej: 123456789" class="form-input mt-1">
                </div>
                <div class="self-end">
                    <button type="submit" class="btn-primary w-full md:w-auto">Buscar</button>
                </div>
            </form>
            <div id="search-results-container" class="mt-4">
                </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow mb-8">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">2. Añadir Nuevo Comentario</h2>
            <form id="form-nuevo-comentario" class="space-y-4">
                
                <input type="hidden" id="reservaId" name="reservaId">
                <input type="hidden" id="clienteId" name="clienteId">
                <input type="hidden" id="canalId" name="canalId">
                <input type="hidden" id="idReservaCanal" name="idReservaCanal">

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Cliente</label>
                        <input type="text" id="clienteNombre" name="clienteNombre" class="form-input mt-1 bg-gray-100" readonly>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Alojamiento</label>
                        <input type="text" id="alojamientoNombre" name="alojamientoNombre" class="form-input mt-1 bg-gray-100" readonly>
                    </div>
                </div>

                <div>
                    <label for="comentario" class="block text-sm font-medium text-gray-700">Comentario</label>
                    <textarea id="comentario" name="comentario" rows="4" class="form-input mt-1" required></textarea>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label for="fecha" class="block text-sm font-medium text-gray-700">Fecha del Comentario</label>
                        <input type="date" id="fecha" name="fecha" class="form-input mt-1" required>
                    </div>
                    <div>
                        <label for="nota" class="block text-sm font-medium text-gray-700">Nota (unificada a 5 estrellas)</label>
                        <input type="number" id="nota" name="nota" min="0" max="5" step="0.1" class="form-input mt-1" required>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label for="foto1" class="block text-sm font-medium text-gray-700">Foto 1 (Opcional)</label>
                        <input type="file" id="foto1" name="foto1" class="form-input-file mt-1" accept="image/*">
                    </div>
                    <div>
                        <label for="foto2" class="block text-sm font-medium text-gray-700">Foto 2 (Opcional)</label>
                        <input type="file" id="foto2" name="foto2" class="form-input-file mt-1" accept="image/*">
                    </div>
                </div>

                <div class="flex justify-end pt-4 border-t">
                    <button type="submit" class="btn-primary">Guardar Comentario</button>
                </div>
            </form>
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Historial de Comentarios</h2>
            <div id="tabla-comentarios-container" class="table-container">
                </div>
        </div>
    `;
}

export function afterRender() {
    // Poblar selects
    poblarSelectCanales(canales, 'canal-select');

    // Renderizar tabla inicial
    const tablaContainer = document.getElementById('tabla-comentarios-container');
    renderComentariosTabla(comentarios, tablaContainer);

    // Configurar Listeners
    document.getElementById('form-buscar-reserva').addEventListener('submit', (e) => {
        e.preventDefault();
        handleSearchFormSubmit(fetchAPI);
    });

    document.getElementById('form-nuevo-comentario').addEventListener('submit', (e) => {
        e.preventDefault();
        handleNewCommentFormSubmit(e.target, fetchAPI, (nuevosComentarios) => {
            comentarios = nuevosComentarios;
            renderComentariosTabla(comentarios, tablaContainer);
        });
    });

    // Listener para los clics en los resultados de búsqueda (usa delegación)
    setupSearchResultsListener('search-results-container', 'form-nuevo-comentario');

    // Listener para los clics en la tabla (usa delegación)
    tablaContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            handleDeleteCommentClick(id, fetchAPI, (nuevosComentarios) => {
                comentarios = nuevosComentarios;
                renderComentariosTabla(comentarios, tablaContainer);
            });
        }
    });
}