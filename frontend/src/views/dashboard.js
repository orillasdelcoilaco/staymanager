import { fetchAPI } from '../api.js';

export async function render() {
    try {
        // Llama a un endpoint protegido para asegurarse de que la autenticación funciona
        const data = await fetchAPI('/dashboard');
        
        return `
            <div class="bg-white p-8 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">Dashboard</h2>
                <p class="text-gray-600">Bienvenido a StayManager. Aquí se mostrarán los KPIs principales de tu negocio.</p>
                <div class="mt-4 p-4 bg-gray-100 rounded-md text-sm font-mono text-gray-700">
                    <p class="font-semibold">Respuesta del servidor:</p>
                    <pre>${JSON.stringify(data, null, 2)}</pre>
                </div>
            </div>
        `;
    } catch (error) {
        return `
            <div class="bg-white p-8 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">Dashboard</h2>
                <p class="text-red-500">Error al cargar los datos del dashboard: ${error.message}</p>
            </div>
        `;
    }
}

