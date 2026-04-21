// frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.helpers.js

export function showCustomConfirm(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Confirmación</h3>
            <p class="text-gray-600 mb-6">${message}</p>
            <div class="flex justify-end gap-3">
                <button id="custom-cancel-btn" class="btn-ghost">Cancelar</button>
                <button id="custom-confirm-btn" class="btn-primary">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    };

    document.getElementById('custom-cancel-btn').onclick = close;
    document.getElementById('custom-confirm-btn').onclick = () => {
        close();
        onConfirm();
    };
}

export function normalizarStr(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function detectarTipoEspacio(comp) {
    const rawTipo = normalizarStr((comp.tipo || '').toUpperCase());
    const rawNombre = normalizarStr((comp.nombre || '').toUpperCase());

    const isDormitorio = rawTipo.includes('DORMITORIO') || rawTipo.includes('HABITACION') || rawTipo.includes('PIEZA') || rawTipo.includes('BEDROOM') ||
        rawNombre.includes('DORMITORIO') || rawNombre.includes('HABITACION');

    const isBano = rawTipo.includes('BANO') || rawTipo.includes('TOILET') || rawTipo.includes('WC') || rawTipo.includes('BATH') ||
        rawNombre.includes('BANO') || rawNombre.includes('TOILET');

    const isSuite = rawNombre.includes('SUITE') || rawTipo.includes('SUITE');

    return { isDormitorio, isBano, isSuite };
}

export function calcularCapacidadElementos(elementos) {
    if (!Array.isArray(elementos)) return 0;
    let capacidad = 0;

    elementos.forEach(elem => {
        const capacity = Number(elem.capacity);
        if (!isNaN(capacity) && capacity > 0 && elem.sumaCapacidad !== false) {
            const cantidad = parseInt(elem.cantidad) || 1;
            capacidad += capacity * cantidad;
        }
    });

    return capacidad;
}

export function getCategoryForSpaceType(tipoEspacio) {
    const t = (tipoEspacio || '').toUpperCase();

    if (t.includes('DORMITORIO') || t.includes('HABITACION') || t.includes('PIEZA')) return 'DORMITORIO';
    if (t.includes('COCINA') || t.includes('KITCHEN')) return 'COCINA';
    if (t.includes('BAÑO') || t.includes('BANO') || t.includes('BATH') || t.includes('TOILET')) return 'BAÑO';
    if (t.includes('LIVING') || t.includes('ESTAR') || t.includes('SALA')) return 'LIVING';
    if (t.includes('COMEDOR') || t.includes('DINING')) return 'COMEDOR';
    if (t.includes('TERRAZA') || t.includes('PATIO') || t.includes('JARDIN') || t.includes('EXTERIOR') || t.includes('QUINCHO')) return 'EXTERIOR';
    if (t.includes('LOGGIA') || t.includes('LAVADERO')) return 'LOGGIA';

    return null;
}

export function buildElementoFromTipo(tipoData) {
    return {
        tipoId: tipoData.id,
        nombre: tipoData.nombre,
        titulo: tipoData.nombre,
        icono: tipoData.icono || '🔹',
        cantidad: 1,
        permiteCantidad: true,
        capacity: (tipoData.capacity !== undefined && tipoData.capacity !== null) ? Number(tipoData.capacity) : 0,
        sumaCapacidad: Number(tipoData.capacity) > 0 ? true : undefined,
        categoria: tipoData.categoria,
        amenity: '',
        sales_context: tipoData.sales_context || ''
    };
}
