// frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.render.js
// Responsabilidad: HTML estático del modal de alojamiento (renderizado inicial).

export const renderModalAlojamiento = () => {
    return `
        <div id="propiedad-modal" class="modal hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-40 flex items-center justify-center">
             <div class="modal-content relative bg-white rounded-lg shadow-xl w-full max-w-5xl mx-4 md:mx-auto my-5 flex flex-col max-h-[95vh]">
                 <div class="flex items-center gap-4 p-5 border-b">
                    <div class="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 text-xl flex-shrink-0">🏡</div>
                    <div class="flex-1">
                        <h3 id="modal-title" class="text-xl font-semibold text-gray-900"></h3>
                        <p id="modal-alojamiento-subtitle" class="text-sm text-gray-500">Configura los datos del alojamiento</p>
                    </div>
                    <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                </div>
                <div class="p-6 overflow-y-auto bg-gray-50">
                    <form id="propiedad-form" class="space-y-6">

                        <!-- SECCIÓN 1: DATOS BÁSICOS -->
                        <div class="bg-white p-6 rounded-lg shadow-sm border">
                            <h4 class="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Información General</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div class="lg:col-span-2">
                                    <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Alojamiento</label>
                                    <input type="text" id="nombre" name="nombre" required class="form-input mt-1 w-full" placeholder="Ej: Cabaña del Lago">
                                </div>
                                <div>
                                    <label for="capacidad" class="block text-sm font-medium text-gray-700">Capacidad Máxima</label>
                                    <input type="number" id="capacidad" name="capacidad" required class="form-input mt-1 w-full">
                                </div>
                                <div>
                                    <label for="numPiezas" class="block text-sm font-medium text-gray-700">Nº Piezas (Ref)</label>
                                    <input type="number" id="numPiezas" name="numPiezas" class="form-input mt-1 w-full" readonly>
                                </div>
                                <div>
                                    <label for="numBanos" class="block text-sm font-medium text-gray-700">Nº Baños (Ref)</label>
                                    <input type="number" id="numBanos" name="numBanos" class="form-input mt-1 w-full" readonly>
                                </div>
                            </div>
                        </div>

                        <!-- SECCIÓN 2: CONSTRUCTOR DE ESPACIOS (CORE) -->
                        <div class="bg-white p-6 rounded-lg shadow-sm border border-primary-100">
                            <div class="flex justify-between items-center mb-4 border-b pb-2">
                                <div>
                                    <h4 class="text-lg font-semibold text-primary-700">Distribución y Contenido</h4>
                                    <p class="text-sm text-gray-500">Define los espacios (dormitorios, baños) y qué hay dentro de ellos.</p>
                                </div>
                            </div>

                            <!-- Formulario Agregar Componente -->
                            <div class="bg-primary-50 p-4 rounded-lg mb-6 flex flex-col md:flex-row gap-4 items-end border border-primary-100">
                                <div class="flex-grow">
                                    <label class="block text-xs font-medium text-primary-800 uppercase mb-1">Nombre del Espacio</label>
                                    <input type="text" id="nuevo-componente-nombre" placeholder="Ej: Dormitorio Principal" class="form-input w-full">
                                </div>
                                <div class="md:w-1/3">
                                    <label class="block text-xs font-medium text-primary-800 uppercase mb-1">Tipo</label>
                                    <select id="nuevo-componente-tipo" class="form-select w-full">
                                        <option value="">Cargando...</option>
                                    </select>
                                </div>
                                <button type="button" id="agregar-componente-btn" class="btn-primary whitespace-nowrap">
                                    + Agregar Espacio
                                </button>
                            </div>

                            <!-- Lista de Componentes -->
                            <div id="lista-componentes" class="space-y-4"></div>
                        </div>

                        <!-- SECCIÓN 3: CONFIGURACIÓN AVANZADA -->
                        <div class="bg-white p-6 rounded-lg shadow-sm border">
                            <h4 class="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Configuración Avanzada</h4>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Google Hotels & SEO</label>
                                    <div class="space-y-3">
                                        <div><label class="text-xs text-gray-500">ID Alojamiento</label><input type="text" id="googleHotelId" class="form-input w-full mt-1"></div>
                                        <div><label class="flex items-center space-x-2"><input type="checkbox" id="googleHotelIsListed" class="rounded text-primary-600"><span>Publicar en Web/Google</span></label></div>
                                    </div>
                                </div>
                                <!-- Ubicación: se inyecta dinámicamente si tipoNegocio === 'cartera' -->
                                <div id="ubicacion-propiedad-container" class="hidden">
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Ubicación del Alojamiento</label>
                                    <div id="ubicacion-propiedad-widget"></div>
                                </div>
                            </div>
                        </div>

                        <div id="ical-fields-container" class="hidden"></div>

                        <!-- SECCIÓN 4: INSTALACIONES DEL RECINTO (se inyecta dinámicamente) -->
                        <div id="areas-comunes-section" class="hidden bg-white p-6 rounded-lg shadow-sm border border-success-100">
                            <h4 class="text-lg font-semibold text-gray-800 mb-1 border-b pb-2">Instalaciones del Recinto</h4>
                            <p class="text-sm text-gray-500 mb-3">Selecciona qué instalaciones tiene derecho a uso este alojamiento.</p>
                            <div id="areas-comunes-checks" class="flex flex-wrap gap-2"></div>
                        </div>
                    </form>
                </div>
                <div class="p-5 border-t bg-white rounded-b-lg flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
                    <button type="button" id="cancel-btn" class="btn-outline">Cancelar</button>
                    <button type="submit" form="propiedad-form" class="btn-primary px-8">Guardar Todo</button>
                </div>
            </div>
        </div>
    `;
};
