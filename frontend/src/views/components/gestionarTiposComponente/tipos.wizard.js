// frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js
import { fetchAPI } from '../../../api.js';

let onSaveCallback = null;
let currentAnalisis = null; // Para guardar temporalmente el resultado de la IA

export const renderWizardModal = () => `
    <div id="tipo-wizard-modal" class="modal hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div class="modal-content relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 md:mx-auto">
            
            <div class="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-lg">
                <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                    ✨ Nuevo Tipo de Espacio (IA)
                </h3>
                <button id="close-wizard-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div class="p-6">
                
                <div id="step-1-input" class="space-y-4">
                    <p class="text-gray-600 text-sm">
                        Escribe el nombre del espacio que quieres agregar (ej: "Quincho", "Rincón de Lectura", "Cava"). 
                        <br><strong>Nuestra IA definirá automáticamente el estándar de fotografía y SEO.</strong>
                    </p>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del Espacio</label>
                        <div class="flex gap-2">
                            <input type="text" id="input-nombre-usuario" class="form-input flex-1" placeholder="Ej: Quincho para asados..." autofocus>
                            <button id="btn-analizar-ia" class="btn-primary whitespace-nowrap px-6">
                                🤖 Analizar
                            </button>
                        </div>
                    </div>
                </div>

                <div id="step-loading" class="hidden py-8 text-center">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                    <p class="text-indigo-600 font-medium animate-pulse">La IA está diseñando el perfil del espacio...</p>
                    <p class="text-xs text-gray-400 mt-1">Definiendo tiros de cámara y palabras clave</p>
                </div>

                <div id="step-2-review" class="hidden space-y-6">
                    <div class="bg-indigo-50 p-4 rounded-md border border-indigo-100">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            <div class="md:col-span-1 text-center">
                                <span id="review-icono" class="text-5xl">🏠</span>
                            </div>
                            <div class="md:col-span-3">
                                <label class="block text-xs font-semibold text-indigo-600 uppercase tracking-wide">Nombre Normalizado</label>
                                <input type="text" id="review-nombre-normalizado" class="w-full font-bold text-lg text-gray-900 bg-transparent border-b border-indigo-200 focus:outline-none focus:border-indigo-500 pb-1">
                                <input type="text" id="review-descripcion" class="w-full text-sm text-gray-600 mt-1 bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none" placeholder="Descripción...">
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 class="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            📸 Shot List (Guía de Fotos Obligatoria)
                            <span class="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Sugerido por IA</span>
                        </h4>
                        <ul id="review-shotlist" class="space-y-2 text-sm text-gray-700 bg-gray-50 p-4 rounded-md border border-gray-200 max-h-40 overflow-y-auto">
                            </ul>
                        <p class="text-xs text-gray-400 mt-2 text-right">* Estos serán los requisitos al subir fotos.</p>
                    </div>
                </div>

            </div>

            <div class="p-5 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
                <button id="btn-cancelar-wizard" class="btn-secondary">Cancelar</button>
                <button id="btn-guardar-tipo" class="btn-primary hidden">Confirmar y Crear</button>
            </div>
        </div>
    </div>
`;

export const setupWizardEvents = (onSave) => {
    onSaveCallback = onSave;
    const modal = document.getElementById('tipo-wizard-modal');
    
    // Cerrar
    const cerrar = () => {
        modal.classList.add('hidden');
        resetWizard();
    };
    document.getElementById('close-wizard-btn').addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-wizard').addEventListener('click', cerrar);

    // Paso 1: Analizar
    document.getElementById('btn-analizar-ia').addEventListener('click', handleAnalizar);
    document.getElementById('input-nombre-usuario').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') handleAnalizar();
    });

    // Paso 2: Guardar
    document.getElementById('btn-guardar-tipo').addEventListener('click', handleGuardar);
};

export const openWizard = () => {
    const modal = document.getElementById('tipo-wizard-modal');
    modal.classList.remove('hidden');
    document.getElementById('input-nombre-usuario').focus();
};

const resetWizard = () => {
    document.getElementById('step-1-input').classList.remove('hidden');
    document.getElementById('step-loading').classList.add('hidden');
    document.getElementById('step-2-review').classList.add('hidden');
    document.getElementById('btn-guardar-tipo').classList.add('hidden');
    document.getElementById('input-nombre-usuario').value = '';
    currentAnalisis = null;
};

const handleAnalizar = async () => {
    const nombreUsuario = document.getElementById('input-nombre-usuario').value.trim();
    if (!nombreUsuario) return;

    // UI Loading
    document.getElementById('step-1-input').classList.add('hidden');
    document.getElementById('step-loading').classList.remove('hidden');

    try {
        // Llamada a nuestro nuevo servicio IA en Backend
        currentAnalisis = await fetchAPI('/componentes/analizar-ia', {
            method: 'POST',
            body: { nombre: nombreUsuario }
        });

        // Renderizar resultados
        document.getElementById('review-icono').textContent = currentAnalisis.icono;
        document.getElementById('review-nombre-normalizado').value = currentAnalisis.nombreNormalizado;
        document.getElementById('review-descripcion').value = currentAnalisis.descripcionBase;
        
        const shotListHtml = currentAnalisis.shotList.map(item => 
            `<li class="flex items-start gap-2"><span class="text-green-500 font-bold">✓</span> ${item}</li>`
        ).join('');
        document.getElementById('review-shotlist').innerHTML = shotListHtml;

        // Mostrar paso 2
        document.getElementById('step-loading').classList.add('hidden');
        document.getElementById('step-2-review').classList.remove('hidden');
        document.getElementById('btn-guardar-tipo').classList.remove('hidden');

    } catch (error) {
        alert(`Error en el análisis: ${error.message}`);
        resetWizard();
    }
};

const handleGuardar = async () => {
    if (!currentAnalisis) return;

    const btn = document.getElementById('btn-guardar-tipo');
    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
        // Permitir que el usuario haya editado el nombre/descripción en el paso 2
        const datosFinales = {
            ...currentAnalisis,
            nombreNormalizado: document.getElementById('review-nombre-normalizado').value,
            descripcionBase: document.getElementById('review-descripcion').value,
            nombreUsuario: document.getElementById('input-nombre-usuario').value // Guardamos el original como referencia
        };

        await fetchAPI('/componentes', {
            method: 'POST',
            body: datosFinales
        });

        document.getElementById('tipo-wizard-modal').classList.add('hidden');
        resetWizard();
        if (onSaveCallback) onSaveCallback();

    } catch (error) {
        alert(`Error al guardar: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar y Crear';
    }
};