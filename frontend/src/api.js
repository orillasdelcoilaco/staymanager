// --- Lógica de Sesión ---
export function logout() {
    localStorage.removeItem('idToken');
}

export async function register(data) {
    // La ruta de registro es pública, no necesita token, por eso se maneja aparte
    // pero ahora la centralizamos para que use la misma URL base.
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
        // Si no hay token, no podemos hacer una llamada autenticada.
        // El router se encargará de redirigir a /login.
        throw new Error('No autenticado');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    // Si el body no es FormData, lo convertimos a JSON
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        if (options.body) {
            options.body = JSON.stringify(options.body);
        }
    }
    
    // El servidor se ejecuta en el mismo origen, no necesitamos la URL completa.
    const url = `/api${endpoint}`;

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            logout(); // Si el token es inválido, cerramos sesión.
            window.location.hash = '/login'; // Redirigimos al login
            throw new Error('Sesión expirada o inválida.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.error || errorData.message || 'Error en la petición a la API');
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