import { renderMenu, handleNavigation } from './router.js';
import { fetchAPI, logout } from './api.js';

let currentUser = null;

// Esta función se exporta para ser llamada por el router
export function renderAppLayout() {
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `
        <div id="app-container" class="flex min-h-screen">
            <div id="sidebar-overlay" class="sidebar-overlay"></div>
            <aside id="sidebar" class="sidebar">
                <div class="sidebar-header">
                    <div class="flex items-center justify-between p-4">
                        <h1 id="sidebar-title" class="text-xl font-bold text-white"><span>StayManager</span></h1>
                        <button id="sidebar-toggle-desktop" class="p-2 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white hidden md:block">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button id="sidebar-close-mobile" class="p-2 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white md:hidden">
                             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                <nav id="main-nav" class="flex-grow mt-4"></nav>
                <footer class="sidebar-footer">
                    <p>Desarrollado por Sacatines SPA</p>
                    <p>Todos los derechos reservados V 1.0.0</p>
                </footer>
            </aside>
            <div id="main-content" class="main-content">
                <header class="bg-white shadow-sm">
                    <div class="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
                         <button id="sidebar-toggle-mobile" class="p-2 rounded-md text-gray-500 hover:bg-gray-100 md:hidden">
                            <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        </button>
                        <div class="flex-grow"></div>
                        <div id="auth-info" class="flex items-center space-x-4"></div>
                    </div>
                </header>
                <main id="view-content" class="mx-auto py-6 sm:px-6 lg:px-8 w-full"></main>
            </div>
        </div>
    `;
    
    // Configurar información del usuario y eventos
    const authInfo = document.getElementById('auth-info');
    authInfo.innerHTML = `
        <span class="text-sm font-semibold text-gray-700 truncate">${currentUser.nombreEmpresa}</span>
        <span class="text-sm text-gray-600 hidden sm:block">${currentUser.email}</span>
        <button id="logout-btn" class="px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 flex-shrink-0">Cerrar Sesión</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => {
        logout();
        handleNavigation('/login'); 
    });
    
    renderMenu();
    setupSidebarToggle();
}

export async function checkAuthAndRender() {
    const token = localStorage.getItem('idToken');
    
    if (!token) {
        currentUser = null;
        return false;
    }
    
    try {
        // Verificar el token con el backend para obtener los datos del usuario
        const userData = await fetchAPI('/auth/me'); 
        currentUser = userData;
        return true;
    } catch (error) {
        console.error("Token inválido o sesión expirada:", error);
        localStorage.removeItem('idToken');
        currentUser = null;
        return false;
    }
}

function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const mainContent = document.getElementById('main-content');
    const toggleMobileBtn = document.getElementById('sidebar-toggle-mobile');
    const closeMobileBtn = document.getElementById('sidebar-close-mobile');
    const toggleDesktopBtn = document.getElementById('sidebar-toggle-desktop');

    const openMobileMenu = () => {
        sidebar.classList.add('open');
        overlay.classList.add('visible');
    };

    const closeMobileMenu = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    };

    if (toggleMobileBtn) {
        toggleMobileBtn.addEventListener('click', openMobileMenu);
    }
    if (closeMobileBtn) {
        closeMobileBtn.addEventListener('click', closeMobileMenu);
    }
    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }
    if (toggleDesktopBtn) {
        toggleDesktopBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('collapsed');
        });
    }
}