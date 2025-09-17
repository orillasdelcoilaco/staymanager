import { checkAuthAndRender, renderAppLayout } from './app.js';

const views = {
    '/login': () => import('./views/login.js'),
    '/': () => import('./views.dashboard.js'),
    '/gestion-diaria': () => import('./views/gestionDiaria.js'),
    '/calendario': () => import('./views/calendario.js'),
    '/clientes': () => import('./views/clientes.js'),
    '/gestionar-alojamientos': () => import('./views/gestionarAlojamientos.js'),
    '/gestionar-canales': () => import('./views/gestionarCanales.js'),
    '/gestionar-tarifas': () => import('./views/gestionarTarifas.js'), // <-- AÑADIDO
};

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
            { name: '📈 Gestionar Tarifas', path: '/gestionar-tarifas', id: 'gestionar-tarifas' },
            { name: '🏡 Gestionar Alojamientos', path: '/gestionar-alojamientos', id: 'gestionar-alojamientos' },
        ]
    },
    {
        name: '⚙️ Configuración',
        id: 'configuracion',
        children: [
            { name: '🏢 Empresa', path: '#', id: 'config-empresa' },
            { name: '📡 Gestionar Canales', path: '/gestionar-canales', id: 'gestionar-canales' },
            { name: '🔄 Conversión Alojamientos', path: '#', id: 'config-conversion' },
            { name: '👤 Autorizar Google Contacts', path: '#', id: 'config-google' },
            { name: '🔧 Reparar Estados de Reservas', path: '#', id: 'reparar-estados' },
            { name: '📞 Reparar Teléfonos Faltantes', path: '#', id: 'reparar-telefonos' },
            { name: '🗓️ Sincronizar Calendarios (iCal)', path: '#', id: 'sincronizar-ical' },
        ]
    }
];

// --- Lógica del Router (sin cambios) ---
export async function handleNavigation(path) {
    if (path !== '/login') sessionStorage.setItem('lastPath', path);
    window.history.pushState({}, '', path);
    await loadView(path);
}

async function loadView(path) {
    const isAuthenticated = await checkAuthAndRender();
    const appRoot = document.getElementById('app-root');
    
    if (!isAuthenticated && path !== '/login') return handleNavigation('/login');
    if (isAuthenticated && path === '/login') {
        const lastPath = sessionStorage.getItem('lastPath') || '/';
        return handleNavigation(lastPath);
    }
    
    if (path === '/login') {
        const { renderLogin } = await views['/login']();
        renderLogin(appRoot);
    } else {
        if (!document.getElementById('view-content')) renderAppLayout();
        
        const viewLoader = views[path] || views['/']; 
        const viewModule = await viewLoader();
        
        document.getElementById('view-content').innerHTML = await viewModule.render();
        
        if (viewModule.afterRender && typeof viewModule.afterRender === 'function') {
            viewModule.afterRender();
        }

        updateActiveLink(path);
    }
}

export function renderMenu() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    const renderLink = (linkItem) => {
        const firstSpaceIndex = linkItem.name.indexOf(' ');
        const icon = linkItem.name.substring(0, firstSpaceIndex);
        const text = linkItem.name.substring(firstSpaceIndex + 1);
        return `<li><a href="${linkItem.path}" class="nav-link" data-path="${linkItem.path}">${icon} <span class="link-text">${text}</span></a></li>`;
    };

    let menuHtml = '';
    menuConfig.forEach(item => {
        if (item.children) {
            menuHtml += `<div class="menu-category"><span class="category-title">${item.name}</span><ul>`;
            item.children.forEach(child => { menuHtml += renderLink(child); });
            menuHtml += `</ul></div>`;
        } else {
            menuHtml += `<ul>${renderLink(item)}</ul>`;
        }
    });
    nav.innerHTML = menuHtml;

    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const path = e.currentTarget.getAttribute('href');
            
            const sidebar = document.getElementById('sidebar');
            if (sidebar?.classList.contains('open')) {
                sidebar.classList.remove('open');
                document.getElementById('sidebar-overlay').classList.remove('visible');
            }
            
            if (path !== '#') handleNavigation(path);
        });
    });
}

function updateActiveLink(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === path);
    });
}

window.addEventListener('popstate', () => loadView(window.location.pathname));
document.addEventListener('DOMContentLoaded', () => loadView(window.location.pathname));