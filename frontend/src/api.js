// frontend/src/api.js - REEMPLAZAR COMPLETO
import { getAuth, onIdTokenChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Mantener el token fresco automáticamente en background
if (window.firebaseApp) {
    const auth = getAuth(window.firebaseApp);
    onIdTokenChanged(auth, async (user) => {
        if (user) {
            try {
                const token = await user.getIdToken();
                localStorage.setItem('idToken', token);
            } catch (error) {
                console.error("Error al refrescar token automáticamente", error);
            }
        } else {
            localStorage.removeItem('idToken');
        }
    });
}

// --- Lógica de Sesión ---
export function logout() {
    localStorage.removeItem('idToken');
    if (window.firebaseApp) {
        const auth = getAuth(window.firebaseApp);
        auth.signOut().catch(() => {});
    }
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
        if (options.body && typeof options.body !== 'string') {
            options.body = JSON.stringify(options.body);
        }
    }

    const url = `/api${endpoint}`;

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            // Intento de refrescar token manualmente por expiración
            if (window.firebaseApp) {
                try {
                    const auth = getAuth(window.firebaseApp);
                    
                    // Esperar a que Firebase Auth haya restaurado la sesión desde IndexedDB
                    if (auth.authStateReady) {
                        await auth.authStateReady();
                    }

                    if (auth.currentUser) {
                        const newToken = await auth.currentUser.getIdToken(true);
                        localStorage.setItem('idToken', newToken);
                        
                        // Reintentar la petición original con el nuevo token
                        headers['Authorization'] = `Bearer ${newToken}`;
                        const retryResponse = await fetch(url, { ...options, headers });
                        
                        if (retryResponse.ok) {
                            if (retryResponse.status === 204) return { success: true };
                            return await retryResponse.json();
                        }
                    }
                } catch (e) {
                    console.error("Fallo al reintentar petición con token fresco:", e);
                }
            }

            // Si falla el reintento o no hay usuario, forzar logout
            logout();
            window.location.replace('/login');
            throw new Error('Sesión expirada o inválida.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));

            // Crear un error personalizado con status y data
            const error = new Error(errorData.error || errorData.message || 'Error en la petición a la API');
            error.status = response.status;
            error.data = errorData.data || null;
            error.responseJSON = errorData; // Expose full body for advanced handling (e.g. AI actions)

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