import { checkAuthAndRender, renderAppLayout } from './app.js';

const views = {
    '/login': () => import('./views/login.js'),
    '/': () => import('./views/dashboard.js'),
    // ... (otras vistas)
    '/gestionar-tarifas': () => import('./views/gestionarTarifas.js'),
    '/conversion-alojamientos': () => import('./views/conversionAlojamientos.js'),
    '/procesar-y-consolidar': () => import('./views/procesarYConsolidar.js'),
    '/mapeo-reportes': () => import('./views/mapeoReportes.js'), // <-- AÑADIDO
};

const menuConfig = [
    // ... (otras secciones del menú)
    {
        name: '⚙️ Configuración',
        id: 'configuracion',
        children: [
            { name: '🏢 Empresa', path: '#', id: 'config-empresa' },
            { name: '📡 Gestionar Canales', path: '/gestionar-canales', id: 'gestionar-canales' },
            { name: '🔄 Conversión Alojamientos', path: '/conversion-alojamientos', id: 'config-conversion' },
            { name: '🗺️ Mapeo de Reportes', path: '/mapeo-reportes', id: 'mapeo-reportes' }, // <-- AÑADIDO
            { name: '👤 Autorizar Google Contacts', path: '#', id: 'config-google' },
            // ... (otros items)
        ]
    }
];

// --- Lógica del Router (se mantiene igual, solo se muestra la parte relevante para brevedad) ---

export async function handleNavigation(path) {
    if (path !== '/login') sessionStorage.setItem('lastPath', path);
    window.history.pushState({}, '', path);
    await loadView(path);
}

async function loadView(path) {
    const isAuthenticated = await checkAuthAndRender();
    if (!isAuthenticated && path !== '/login') return handleNavigation('/login');
    if (isAuthenticated && path === '/login') {
        const lastPath = sessionStorage.getItem('lastPath') || '/';
        return handleNavigation(lastPath);
    }
    
    const appRoot = document.getElementById('app-root');
    if (path === '/login') {
        const { renderLogin } = await views['/login']();
        renderLogin(appRoot);
    } else {
        if (!document.getElementById('view-content')) renderAppLayout();
        const viewLoader = views[path] || views['/']; 
        const viewModule = await viewLoader();
        document.getElementById('view-content').innerHTML = await viewModule.render();
        if (viewModule.afterRender) viewModule.afterRender();
        updateActiveLink(path);
    }
}

export function renderMenu() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    // Se reconstruye el menú completo para asegurar consistencia
    const fullMenuConfig = [
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
                { name: '⚙️ Procesar y Consolidar', path: '/procesar-y-consolidar', id: 'procesar-consolidar' },
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
                { name: '🔄 Conversión Alojamientos', path: '/conversion-alojamientos', id: 'config-conversion' },
                { name: '🗺️ Mapeo de Reportes', path: '/mapeo-reportes', id: 'mapeo-reportes' },
                { name: '👤 Autorizar Google Contacts', path: '#', id: 'config-google' },
                { name: '🔧 Reparar Estados de Reservas', path: '#', id: 'reparar-estados' },
                { name: '📞 Reparar Teléfonos Faltantes', path: '#', id: 'reparar-telefonos' },
                { name: '🗓️ Sincronizar Calendarios (iCal)', path: '#', id: 'sincronizar-ical' },
            ]
        }
    ];

    let menuHtml = '';
    const renderLink = (linkItem) => {
        const firstSpaceIndex = linkItem.name.indexOf(' ');
        const icon = linkItem.name.substring(0, firstSpaceIndex);
        const text = linkItem.name.substring(firstSpaceIndex + 1);
        return `<li><a href="${linkItem.path}" class="nav-link" data-path="${linkItem.path}">${icon} <span class="link-text">${text}</span></a></li>`;
    };
    
    fullMenuConfig.forEach(item => {
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