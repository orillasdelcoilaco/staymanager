// frontend/src/views/resenas.js
import { fetchAPI } from '../api.js';

const ESTRELLAS = (rating, max = 10) => {
    if (!rating) return '<span class="text-gray-400">Sin calificación</span>';
    const pct = Math.round((rating / max) * 5);
    return '★'.repeat(pct) + '☆'.repeat(5 - pct);
};

const BADGE_ESTADO = {
    sin_responder: 'bg-warning-100 text-warning-800',
    respondida:    'bg-success-100 text-success-800',
    ignorada:      'bg-gray-100 text-gray-600'
};

const LABEL_ESTADO = {
    sin_responder: 'Sin responder',
    respondida:    'Respondida',
    ignorada:      'Ignorada'
};

const BADGE_CANAL = {
    booking:     'bg-primary-100 text-primary-800',
    airbnb:      'bg-danger-100 text-danger-800',
    google:      'bg-success-100 text-success-800',
    expedia:     'bg-warning-100 text-warning-800',
    vrbo:        'bg-primary-100 text-primary-700',
    tripadvisor: 'bg-success-100 text-success-700',
};

let resenas = [];
let propiedades = [];
let filtroEstado = '';
let filtroCanal = '';
let filtroPropiedad = '';

function renderTarjeta(r) {
    const badgeEstado = BADGE_ESTADO[r.estado] || 'bg-gray-100 text-gray-600';
    const badgeCanal  = BADGE_CANAL[r.canal]  || 'bg-gray-100 text-gray-600';
    const fecha = r.fechaReview
        ? new Date(r.fechaReview).toLocaleDateString('es-CL')
        : '—';

    return `
    <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-3" data-id="${r.id}">
        <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium capitalize ${badgeCanal}">${r.canal}</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-medium ${badgeEstado}">${LABEL_ESTADO[r.estado] || r.estado}</span>
                ${r.propiedadNombre ? `<span class="text-xs text-gray-500">${r.propiedadNombre}</span>` : ''}
            </div>
            <span class="text-xs text-gray-400 shrink-0">${fecha}</span>
        </div>

        <div class="flex items-center gap-3">
            <span class="text-yellow-400 text-lg">${ESTRELLAS(r.rating)}</span>
            ${r.rating ? `<span class="text-sm font-semibold text-gray-700">${r.rating}/10</span>` : ''}
            ${r.reviewerNombre ? `<span class="text-sm text-gray-600">— ${r.reviewerNombre}</span>` : ''}
        </div>

        ${r.texto ? `<p class="text-sm text-gray-700 leading-relaxed">${r.texto}</p>` : ''}

        ${r.respuesta ? `
        <div class="bg-primary-50 border-l-4 border-primary-400 pl-3 py-2 rounded-r">
            <p class="text-xs font-semibold text-primary-700 mb-1">Tu respuesta:</p>
            <p class="text-sm text-primary-900">${r.respuesta}</p>
        </div>` : ''}

        <div class="flex gap-2 pt-1">
            ${r.estado === 'sin_responder' ? `
            <button onclick="abrirModalRespuesta('${r.id}')" class="btn-primary text-xs py-1 px-3">
                Responder
            </button>
            <button onclick="cambiarEstadoResena('${r.id}', 'ignorada')" class="btn-ghost text-xs py-1 px-3">
                Ignorar
            </button>` : ''}
            ${r.estado === 'ignorada' ? `
            <button onclick="cambiarEstadoResena('${r.id}', 'sin_responder')" class="btn-outline text-xs py-1 px-3">
                Marcar pendiente
            </button>` : ''}
        </div>
    </div>`;
}

function renderResumen(resumen) {
    if (!resumen.length) return '';
    return resumen.map(r => `
        <div class="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p class="text-xs text-gray-500 uppercase tracking-wide capitalize">${r.canal}</p>
            <p class="text-2xl font-bold text-gray-800 mt-1">${r.rating_promedio || '—'}</p>
            <p class="text-xs text-gray-500">Promedio</p>
            <p class="text-sm font-medium text-warning-700 mt-2">${r.pendientes} pendientes</p>
        </div>`).join('');
}

async function cargarResenas() {
    const params = new URLSearchParams();
    if (filtroEstado)    params.set('estado', filtroEstado);
    if (filtroCanal)     params.set('canal', filtroCanal);
    if (filtroPropiedad) params.set('propiedadId', filtroPropiedad);

    resenas = await fetchAPI(`/resenas?${params.toString()}`);
    const lista = document.getElementById('lista-resenas');
    if (!lista) return;

    if (!resenas.length) {
        lista.innerHTML = '<p class="text-gray-500 text-center py-8">No hay reseñas con los filtros seleccionados.</p>';
        return;
    }
    lista.innerHTML = resenas.map(renderTarjeta).join('');
}

export async function render() {
    let resumen = [], config = { emailReenvio: '' };
    try {
        [resumen, propiedades, config] = await Promise.all([
            fetchAPI('/resenas/resumen'),
            fetchAPI('/propiedades'),
            fetchAPI('/resenas/config')
        ]);
    } catch (err) {
        console.error('[resenas] Error cargando datos:', err);
    }

    const html = `
    <div class="space-y-6">
        <!-- KPIs por canal -->
        <div id="resumen-canales" class="grid grid-cols-2 md:grid-cols-4 gap-4">
            ${renderResumen(resumen)}
        </div>

        <!-- Filtros -->
        <div class="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap gap-3 items-end">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                <select id="filtro-estado" class="form-select text-sm">
                    <option value="">Todos</option>
                    <option value="sin_responder">Sin responder</option>
                    <option value="respondida">Respondidas</option>
                    <option value="ignorada">Ignoradas</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Canal</label>
                <select id="filtro-canal" class="form-select text-sm">
                    <option value="">Todos</option>
                    <option value="booking">Booking.com</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="google">Google</option>
                    <option value="expedia">Expedia</option>
                    <option value="vrbo">VRBO</option>
                    <option value="tripadvisor">TripAdvisor</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Alojamiento</label>
                <select id="filtro-propiedad" class="form-select text-sm">
                    <option value="">Todos</option>
                    ${propiedades.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                </select>
            </div>
            <button id="btn-filtrar" class="btn-primary text-sm py-1.5 px-4">Filtrar</button>
        </div>

        <!-- Configuración IMAP -->
        <details class="bg-white border border-gray-200 rounded-lg">
            <summary class="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 select-none">
                ⚙️ Configurar recepción automática de reseñas (IMAP)
            </summary>
            <div class="px-4 pb-4 pt-2 border-t border-gray-100">
                <p class="text-xs text-gray-500 mb-3">
                    Configura el correo al que reenvías las notificaciones de OTAs.
                    Cada empresa puede tener su propio correo de reenvío.
                </p>
                <div class="flex gap-3 items-end">
                    <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-600 mb-1">Email de reenvío configurado</label>
                        <input type="email" id="imap-email-display" class="form-input text-sm bg-gray-50 font-mono" readonly
                               value="${config.emailReenvio}"
                               placeholder="Activa configurando IMAP_EMAIL_USER en el sistema">
                    </div>
                </div>
                <p class="text-xs text-gray-400 mt-2">
                    Para activarlo: ve a <strong>Configuración → Empresa</strong> y configura el campo "Email IMAP reseñas".
                    Las reseñas se procesan automáticamente cada hora.
                </p>
            </div>
        </details>

        <!-- Listado -->
        <div id="lista-resenas" class="space-y-3">
            <p class="text-gray-500 text-center py-8">Cargando reseñas...</p>
        </div>
    </div>

    <!-- Modal respuesta -->
    <div id="modal-respuesta" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-lg w-full max-w-lg shadow-xl">
            <div class="flex justify-between items-center px-5 py-4 border-b">
                <h3 class="font-semibold text-gray-800">Responder reseña</h3>
                <button onclick="cerrarModalRespuesta()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div class="p-5 space-y-3">
                <div id="resena-preview" class="bg-gray-50 rounded p-3 text-sm text-gray-700 italic"></div>
                <textarea id="texto-respuesta" rows="4" placeholder="Escribe tu respuesta pública..."
                    class="form-input w-full text-sm resize-none"></textarea>
            </div>
            <div class="flex justify-end gap-2 px-5 py-4 border-t">
                <button onclick="cerrarModalRespuesta()" class="btn-ghost text-sm">Cancelar</button>
                <button onclick="enviarRespuesta()" class="btn-primary text-sm">Guardar respuesta</button>
            </div>
        </div>
    </div>`;

    return html;
}

export async function mount() {
    await cargarResenas();

    document.getElementById('btn-filtrar')?.addEventListener('click', () => {
        filtroEstado    = document.getElementById('filtro-estado')?.value || '';
        filtroCanal     = document.getElementById('filtro-canal')?.value  || '';
        filtroPropiedad = document.getElementById('filtro-propiedad')?.value || '';
        cargarResenas();
    });

    // Funciones globales para los botones inline
    window.abrirModalRespuesta = (id) => {
        const resena = resenas.find(r => r.id === id);
        if (!resena) return;
        document.getElementById('resena-preview').textContent = resena.texto || '(sin texto)';
        document.getElementById('texto-respuesta').value = resena.respuesta || '';
        document.getElementById('modal-respuesta').dataset.resenaId = id;
        document.getElementById('modal-respuesta').classList.remove('hidden');
    };

    window.cerrarModalRespuesta = () => {
        document.getElementById('modal-respuesta').classList.add('hidden');
    };

    window.enviarRespuesta = async () => {
        const modal = document.getElementById('modal-respuesta');
        const id = modal.dataset.resenaId;
        const respuesta = document.getElementById('texto-respuesta').value.trim();
        if (!respuesta) return;

        try {
            await fetchAPI(`/resenas/${id}/responder`, {
                method: 'PUT',
                body: JSON.stringify({ respuesta })
            });
            window.cerrarModalRespuesta();
            await cargarResenas();
        } catch (err) {
            alert('Error al guardar la respuesta: ' + err.message);
        }
    };

    window.cambiarEstadoResena = async (id, estado) => {
        try {
            await fetchAPI(`/resenas/${id}/estado`, {
                method: 'PUT',
                body: JSON.stringify({ estado })
            });
            await cargarResenas();
        } catch (err) {
            alert('Error al cambiar estado: ' + err.message);
        }
    };
}
