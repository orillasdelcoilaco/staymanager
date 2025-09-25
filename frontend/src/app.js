import { renderMenu, handleNavigation } from './router.js';
import { fetchAPI, logout, fetchDailyDollar } from './api.js';

let currentUser = null;

export async function renderAppLayout(dollarInfo) {
    const appRoot = document.getElementById('app-root');
    appRoot.innerHTML = `
        <div id="app-container" class="relative min-h-screen md:flex">
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
                        <div id="auth-info" class="flex-grow flex items-center space-x-4 text-xs md:text-sm"></div>
                        <button id="logout-btn" class="px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 flex-shrink-0">Cerrar Sesión</button>
                    </div>
                </header>
                <main id="view-content"></main>
            </div>
        </div>
    `;
    
    const authInfo = document.getElementById('auth-info');
    const formattedDate = new Date(dollarInfo.fecha + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' });

    authInfo.innerHTML = `
        <span class="font-semibold text-gray-700 truncate">Empresa: ${currentUser.nombreEmpresa}</span>
        <span class="text-gray-600 hidden sm:block">Usuario: ${currentUser.email}</span>
        <span class="font-semibold text-blue-600 flex-shrink-0">Dólar ${formattedDate}: $${dollarInfo.valor.toLocaleString('es-CL')}</span>
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
        const [userData, dollarInfo] = await Promise.all([
            fetchAPI('/auth/me'),
            fetchDailyDollar()
        ]);
        currentUser = userData;
        
        // Si el layout principal ya existe, solo actualizamos los datos.
        // Si no, lo renderizamos por primera vez.
        const authInfo = document.getElementById('auth-info');
        if (authInfo) {
            const formattedDate = new Date(dollarInfo.fecha + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' });
            authInfo.innerHTML = `
                <span class="font-semibold text-gray-700 truncate">Empresa: ${currentUser.nombreEmpresa}</span>
                <span class="text-gray-600 hidden sm:block">Usuario: ${currentUser.email}</span>
                <span class="font-semibold text-blue-600 flex-shrink-0">Dólar ${formattedDate}: $${dollarInfo.valor.toLocaleString('es-CL')}</span>
            `;
        } else {
            renderAppLayout(dollarInfo);
        }

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

    if (toggleMobileBtn) toggleMobileBtn.addEventListener('click', openMobileMenu);
    if (closeMobileBtn) closeMobileBtn.addEventListener('click', closeMobileMenu);
    if (overlay) overlay.addEventListener('click', closeMobileMenu);
    
    if (toggleDesktopBtn) {
        toggleDesktopBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('sidebar-collapsed');
        });
    }
}