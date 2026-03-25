// frontend/src/views/components/estadosStore.js
// Módulo central de estados: caché de sesión + configuración de semántica.
// La SEMÁNTICA es un identificador de máquina fijo; el NOMBRE lo configura cada empresa.
import { fetchAPI } from '../../api.js';

// Tabla fija: semántica → comportamiento del sistema.
// 'level' define qué botones de acción se muestran en Gestión Diaria.
// 'gestionType' define qué modal de mensaje se abre al hacer clic en el badge.
export const SEMANTICA_CONFIG = {
    // Estados de Reserva
    'confirmada':           { esGestion: false },
    'cancelada':            { esGestion: false },
    'no_show':              { esGestion: false },
    'propuesta':            { esGestion: false },
    'desconocido':          { esGestion: false, esRevision: true },
    'ignorar':              { esGestion: false },
    // Estados de Gestión (flujo de trabajo ordenado por 'level')
    'pendiente_bienvenida': { esGestion: true, gestionType: 'enviar_bienvenida', level: 1 },
    'pendiente_cobro':      { esGestion: true, gestionType: 'enviar_cobro',      level: 2 },
    'pendiente_pago':       { esGestion: true, gestionType: null,                level: 3 },
    'pendiente_boleta':     { esGestion: true, gestionType: null,                level: 4 },
    'pendiente_cliente':    { esGestion: true, gestionType: 'enviar_salida',     level: 5 },
    'facturado':            { esGestion: true, gestionType: null,                level: 99 },
    'no_presentado':        { esGestion: true, gestionType: null,                level: 100 },
};

// Etiquetas legibles para el formulario de gestión de estados
export const SEMANTICA_LABELS = {
    'confirmada':           'Reserva Confirmada',
    'cancelada':            'Reserva Cancelada',
    'no_show':              'No Show (reserva)',
    'propuesta':            'Propuesta (pre-confirmación)',
    'desconocido':          'Desconocido / Requiere revisión',
    'ignorar':              'Ignorar (no procesar)',
    'pendiente_bienvenida': 'Gestión: Pendiente Bienvenida (1er envío)',
    'pendiente_cobro':      'Gestión: Pendiente Cobro (2do envío)',
    'pendiente_pago':       'Gestión: Pendiente Pago',
    'pendiente_boleta':     'Gestión: Pendiente Boleta',
    'pendiente_cliente':    'Gestión: Pendiente Cliente (3er envío)',
    'facturado':            'Gestión: Facturado (estado final)',
    'no_presentado':        'Gestión: No Presentado',
};

// Nombres hardcodeados de respaldo para empresas sin estados configurados
const LEGACY_NOMBRES = {
    'confirmada':           'Confirmada',
    'cancelada':            'Cancelada',
    'no_show':              'No Presentado',
    'propuesta':            'Propuesta',
    'desconocido':          'Desconocido',
    'ignorar':              'Ignorar',
    'pendiente_bienvenida': 'Pendiente Bienvenida',
    'pendiente_cobro':      'Pendiente Cobro',
    'pendiente_pago':       'Pendiente Pago',
    'pendiente_boleta':     'Pendiente Boleta',
    'pendiente_cliente':    'Pendiente Cliente',
    'facturado':            'Facturado',
    'no_presentado':        'No Presentado',
};

let _cache = null;

export async function getEstados() {
    if (!_cache) {
        _cache = await fetchAPI('/estados');
    }
    return _cache;
}

export function invalidarCache() {
    _cache = null;
}

export function getEstadosReserva(todos) {
    return todos.filter(e => !e.esEstadoDeGestion).sort((a, b) => a.orden - b.orden);
}

export function getEstadosGestion(todos) {
    return todos.filter(e => e.esEstadoDeGestion).sort((a, b) => a.orden - b.orden);
}

export function findEstado(allEstados, nombre) {
    return allEstados.find(e => e.nombre === nombre) || null;
}

// Retorna info de display y comportamiento de un estado por su nombre.
// Incluye fallback para empresas sin semantica asignada (usa nombres legacy).
export function getStatusInfo(statusName, allEstados = []) {
    const estado = findEstado(allEstados, statusName);
    const config = (estado?.semantica && SEMANTICA_CONFIG[estado.semantica]) ? SEMANTICA_CONFIG[estado.semantica] : {};

    // Fallback de colores para estados legacy sin semantica
    let fallbackColor = '#9ca3af';
    if (!estado) {
        const legacyMap = {
            'Confirmada': '#22c55e', 'Cancelada': '#ef4444', 'No Presentado': '#ef4444',
            'Propuesta': '#f59e0b', 'Desconocido': '#f59e0b',
            'Pendiente Bienvenida': '#6366f1', 'Pendiente Cobro': '#f59e0b',
            'Pendiente Pago': '#f59e0b', 'Pendiente Boleta': '#f59e0b',
            'Pendiente Cliente': '#6366f1', 'Facturado': '#22c55e',
        };
        fallbackColor = legacyMap[statusName] || '#9ca3af';
    }

    // Fallback de config para estados legacy sin semantica
    let fallbackConfig = config;
    if (!estado?.semantica && statusName) {
        const legacyConfig = {
            'Pendiente Bienvenida': { level: 1, gestionType: 'enviar_bienvenida' },
            'Pendiente Cobro':      { level: 2, gestionType: 'enviar_cobro' },
            'Pendiente Pago':       { level: 3, gestionType: null },
            'Pendiente Boleta':     { level: 4, gestionType: null },
            'Pendiente Cliente':    { level: 5, gestionType: 'enviar_salida' },
            'Facturado':            { level: 99, gestionType: null },
            'No Presentado':        { level: 100, gestionType: null },
            'Desconocido':          { level: 0, gestionType: 'corregir_estado', esRevision: true },
        };
        fallbackConfig = legacyConfig[statusName] || {};
    }

    return {
        text:        statusName ? statusName.toUpperCase() : 'DESCONOCIDO',
        color:       estado?.color || fallbackColor,
        level:       fallbackConfig.level ?? 0,
        gestionType: fallbackConfig.gestionType ?? null,
        semantica:   estado?.semantica || null,
        esRevision:  fallbackConfig.esRevision || config.esRevision || false,
    };
}

// Retorna los nombres de estados que tienen alguna de las semánticas indicadas.
// Si allEstados está vacío, usa nombres legacy como respaldo.
export function getNombresConSemantica(allEstados, semanticas) {
    if (!allEstados.length) {
        return semanticas.map(s => LEGACY_NOMBRES[s]).filter(Boolean);
    }
    return allEstados.filter(e => semanticas.includes(e.semantica)).map(e => e.nombre);
}

// Genera <option> elements para un select de estados
export function renderOpcionesEstados(allEstados, { soloReserva = false, soloGestion = false, valorSeleccionado = '' } = {}) {
    let lista = allEstados;
    if (soloReserva) lista = getEstadosReserva(allEstados);
    if (soloGestion) lista = getEstadosGestion(allEstados);
    return lista.map(e => `<option value="${e.nombre}" ${e.nombre === valorSeleccionado ? 'selected' : ''}>${e.nombre}</option>`).join('');
}
