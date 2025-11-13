// frontend/src/api.js - REEMPLAZAR COMPLETO

// --- Lógica de Sesión ---
export function logout() {
    localStorage.removeItem('idToken');
}

export async function register(data) {
    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en el registro.');
    }
    return response.json();
}

// --- Lógica General de API ---
export async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('idToken');
    if (!token) {
        throw new Error('No autenticado');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        if (options.body) {
            options.body = JSON.stringify(options.body);
        }
    }
    
    const url = `/api${endpoint}`;

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            logout();
            window.location.hash = '/login';
            throw new Error('Sesión expirada o inválida.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            
            // Crear un error personalizado con status y data
            const error = new Error(errorData.error || errorData.message || 'Error en la petición a la API');
            error.status = response.status;
            error.data = errorData.data || null;
            
            throw error;
        }
        
        if (response.status === 204) {
            return { success: true };
        }

        return await response.json();
    } catch (error) {
        console.error(`Error en fetchAPI para el endpoint ${endpoint}:`, error);
        throw error;
    }
}

export async function fetchDailyDollar() {
    try {
        const data = await fetchAPI('/dolar/hoy');
        return data;
    } catch (error) {
        console.error("No se pudo obtener el valor del dólar:", error);
        return { valor: 'N/A', fecha: new Date().toISOString().split('T')[0] };
    }
}