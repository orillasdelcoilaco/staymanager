import { checkAuthAndRender, renderAppLayout } from './app.js';

// --- Configuración de Vistas ---
// Mapea las rutas a funciones que importan dinámicamente los módulos de las vistas.
const views = {
    '/login': () => import('./views/login.js'),
    '/': () => import('./views/dashboard.js'),
    '/gestion-diaria': () => import('./views/gestionDiaria.js'),
    '/calendario': () => import('./views/calendario.js'),
    '/clientes': () => import('./views/clientes.js'),
};

// Configuración del menú lateral (NUEVA ESTRUCTURA)
// Los paths '#' son temporales para los items sin vista aún.
const menuConfig = [
    { name: '📊 Dashboard', path: '/', id: 'dashboard' },
    { 
        name: '💼 Flujo de Trabajo',
        id: 'flujo-trabajo',
        children: [
            { name: '☀️ Gestión Diaria', path: '/gestion-diaria', id: 'gestion-diaria' },
            { name: '📅 Calendario', path: '/calendario', id: 'calendario' },
            { name: '📄 Generar Reportes Rápidos', path: '#', id: 'reportes-rapidos' },
            { name: '➕ Agregar Propuesta', path: '#', id: 'agregar-propuesta' },
            { name: '🗂️ Gestionar Propuestas', path: '#', id: 'gestionar-propuestas' },
            { name: '💬 Generar mensajes', path: '#', id: 'generar-mensajes' },
            { name: '💲 Generar Presupuestos', path: '#', id: 'generar-presupuestos' },
        ]
    },
    {
        name: '🛠️ Herramientas',
        id: 'herramientas',
        children: [
            { name: '🔄 Sincronizar Datos', path: '#', id: 'sincronizar-datos' },
            { name: '⚙️ Procesar y Consolidar', path: '#', id: 'procesar-consolidar' },
            { name: '👥 Gestionar Clientes', path: '/clientes', id: 'clientes' },
            { name: '🏨 Gestionar Reservas', path: '#', id: 'gestionar-reservas' },
            { name: '📈 Gestionar Tarifas', path: '#', id: 'gestionar-tarifas' },
            { name: '🏡 Gestionar Alojamientos', path: '#', id: 'gestionar-alojamientos' },
        ]
    },
    {
        name: '⚙️ Configuración',
        id: 'configuracion',
        children: [
            { name: '🏢 Empresa', path: '#', id: 'config-empresa' },
            { name: '🔄 Conversión Alojamientos', path: '#', id: 'config-conversion' },
            { name: '👤 Autorizar Google Contacts', path: '#', id: 'config-google' },
            { name: '🔧 Reparar Estados de Reservas', path: '#', id: 'reparar-estados' },
            { name: '📞 Reparar Teléfonos Faltantes', path: '#', id: 'reparar-telefonos' },
            { name: '🗓️ Sincronizar Calendarios (iCal)', path: '#', id: 'sincronizar-ical' },
        ]
    }
];


// --- Lógica del Router ---

/**
 * Navega a una nueva ruta de la aplicación.
 * @param {string} path La ruta a la que se quiere navegar.
 */
export async function handleNavigation(path) {
    // Si la ruta no es la de login, la guarda para redirigir después del login.
    if (path !== '/login') {
        sessionStorage.setItem('lastPath', path);
    }
    
    // Cambia la URL en la barra de direcciones del navegador
    window.history.pushState({}, '', path);
    // Carga la vista correspondiente a la nueva ruta
    await loadView(path);
}

/**
 * Carga la vista apropiada basándose en la ruta y el estado de autenticación.
 * @param {string} path La ruta actual a cargar.
 */
async function loadView(path) {
    const isAuthenticated = await checkAuthAndRender();
    const appRoot = document.getElementById('app-root');
    
    // Si el usuario no está autenticado y no está en la página de login, lo redirige.
    if (!isAuthenticated && path !== '/login') {
        return handleNavigation('/login');
    }

    // Si el usuario está autenticado y intenta ir al login, lo redirige al dashboard.
    if (isAuthenticated && path === '/login') {
        const lastPath = sessionStorage.getItem('lastPath') || '/';
        return handleNavigation(lastPath);
    }
    
    // Carga la vista de login si corresponde
    if (path === '/login') {
        const { renderLogin } = await views['/login']();
        renderLogin(appRoot);
    } else {
        // Si está autenticado, renderiza el layout principal si aún no existe
        const viewContentDiv = document.getElementById('view-content');
        if (!viewContentDiv) {
            renderAppLayout();
        }
        
        // Carga el módulo de la vista dinámicamente
        const viewLoader = views[path] || views['/']; 
        const { render } = await viewLoader();
        document.getElementById('view-content').innerHTML = await render();
        updateActiveLink(path);
    }
}

/**
 * Construye el menú lateral a partir de la configuración.
 */
export function renderMenu() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    let menuHtml = '';
    menuConfig.forEach(item => {
        // Función auxiliar para renderizar un enlace
        const renderLink = (linkItem) => {
            const firstSpaceIndex = linkItem.name.indexOf(' ');
            const icon = linkItem.name.substring(0, firstSpaceIndex);
            const text = linkItem.name.substring(firstSpaceIndex + 1);
            return `<li><a href="${linkItem.path}" class="nav-link" data-path="${linkItem.path}">${icon} <span class="link-text">${text}</span></a></li>`;
        };

        if (item.children) {
            menuHtml += `<div class="menu-category">
                            <span class="category-title">${item.name}</span>
                            <ul>`;
            item.children.forEach(child => {
                menuHtml += renderLink(child);
            });
            menuHtml += `</ul></div>`;
        } else {
            menuHtml += `<ul>${renderLink(item)}</ul>`;
        }
    });
    nav.innerHTML = menuHtml;

    // Añade los event listeners para que la navegación funcione sin recargar la página
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const path = e.currentTarget.getAttribute('href');
            if (path !== '#') {
                handleNavigation(path);
            }
        });
    });
}

/**
 * Resalta el enlace activo en el menú lateral.
 * @param {string} path La ruta activa actualmente.
 */
function updateActiveLink(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === path) {
            link.classList.add('active');
        }
    });
}

// --- Punto de Entrada de la Aplicación ---

// Escucha los botones de "atrás" y "adelante" del navegador
window.addEventListener('popstate', () => {
    loadView(window.location.pathname);
});

// Carga inicial de la aplicación cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
    loadView(window.location.pathname);
});