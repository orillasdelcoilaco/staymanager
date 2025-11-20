// frontend/src/views/components/agregarPropuesta/propuesta.state.js
import { fetchAPI } from '../../../api.js';

// Estado centralizado
export const state = {
    allClients: [],
    allProperties: [],
    allCanales: [],
    allPlantillas: [],
    selectedClient: null,
    availabilityData: {},
    selectedProperties: [],
    currentPricing: {},
    editId: null,
    valorDolarDia: 0,
    origenReserva: 'manual'
};

/**
 * Carga los datos iniciales del servidor.
 * Retorna true si fue exitoso.
 */
export async function fetchInitialData() {
    try {
        const [clients, properties, canales, plantillas] = await Promise.all([
            fetchAPI('/clientes'),
            fetchAPI('/propiedades'),
            fetchAPI('/canales'),
            fetchAPI('/plantillas')
        ]);

        state.allClients = clients;
        state.allProperties = properties;
        state.allCanales = canales;
        state.allPlantillas = plantillas;
        
        return true;
    } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
        return false;
    }
}

// Reinicia el estado temporal de búsqueda
export function resetSearchState() {
    state.availabilityData = {};
    state.selectedProperties = [];
    state.currentPricing = {};
    state.valorDolarDia = 0;
}