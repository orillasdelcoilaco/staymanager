import { checkAuthAndRender, renderAppLayout } from './app.js';

const views = {
    '/login': () => import('./views/login.js'),
    '/': () => import('./views/dashboard.js'),
    '/gestion-diaria': () => import('./views/gestionDiaria.js'),
    '/calendario': () => import('./views/calendario.js'),
    '/clientes': () => import('./views/gestionarClientes.js'),
    '/cliente/:id': () => import('./views/perfilCliente.js'),
    '/cliente/:id/mensaje/:reservaId': () => import('./views/enviarMensajeCliente.js'),
    '/gestionar-alojamientos': () => import('./views/gestionarAlojamientos.js'),
    '/gestionar-canales': () => import('./views/gestionarCanales.js'),
    '/gestionar-tarifas': () => import('./views/gestionarTarifas.js'),
    '/conversion-alojamientos': () => import('./views/conversionAlojamientos.js'),
    '/mapeo-reportes': () => import('./views/mapeoReportes.js'),
    '/procesar-y-consolidar': () => import('./views/procesarYConsolidar.js'),
    '/gestionar-reservas': () => import('./views/gestionarReservas.js'),
    '/reparar-fechas': () => import('./views/repararFechas.js'),
};

// --- INICIO DE CAMBIOS: Nueva estructura jerárquica del menú ---
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
            { name: '⚙️ Procesar y Consolidar', path: '/procesar-y-consolidar', id: 'procesar-consolidar' },
            { name: '👥 Gestionar Clientes', path: '/clientes', id: 'clientes' },
            { name: '🏨 Gestionar Reservas', path: '/gestionar-reservas', id: 'gestionar-reservas' }, 
            { name: '📈 Gestionar Tarifas', path: '/gestionar-tarifas', id: 'gestionar-tarifas' },
            { name: '🏡 Gestionar Alojamientos', path: '/gestionar-alojamientos', id: 'gestionar-alojamientos' },
            { name: '📡 Gestionar Canales', path: '/gestionar-canales', id: 'gestionar-canales' },
        ]
    },
    {
        name: '⚙️ Configuración',
        id: 'configuracion',
        children: [
            { name: '🏢 Empresa', path: '#', id: 'config-empresa' },
            { name: '🔄 Conversión Alojamientos', path: '/conversion-alojamientos', id: 'config-conversion' },
            { name: '🗺️ Mapeo de Reportes', path: '/mapeo-reportes', id: 'mapeo-reportes' },
            { name: '👤 Autorizar Google Contacts', path: '#', id: 'config-google' },
            { name: '🔧 Reparar Fechas de Reservas', path: '/reparar-fechas', id: 'reparar-fechas' },
            { name: '📞 Reparar Teléfonos Faltantes', path: '#', id: 'reparar-telefonos' },
            { name: '🗓️ Sincronizar Calendarios (iCal)', path: '#', id: 'sincronizar-ical' },
        ]
    }
];
// --- FIN DE CAMBIOS ---

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
        
        const dynamicRoute = Object.keys(views).find(route => {
            const regex = new RegExp(`^${route.replace(/:\w+/g, '([^/]+)')}$`);
            return regex.test(path);
        });

        const viewLoader = views[dynamicRoute] || views['/'];
        const viewModule = await viewLoader();
        
        document.getElementById('view-content').innerHTML = await viewModule.render();
        
        if (viewModule.afterRender && typeof viewModule.afterRender === 'function') {
            viewModule.afterRender();
        }

        updateActiveLink(path);
    }
}

// --- INICIO DE CAMBIOS: Lógica de renderizado y eventos del menú actualizada ---
export function renderMenu() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    let menuHtml = '';

    const createLink = (item) => {
        const firstSpaceIndex = item.name.indexOf(' ');
        const icon = item.name.substring(0, firstSpaceIndex);
        const text = item.name.substring(firstSpaceIndex + 1);
        return `<li><a href="${item.path}" class="nav-link" data-path="${item.path}">${icon} <span class="link-text">${text}</span></a></li>`;
    };

    menuConfig.forEach(item => {
        if (item.children) {
            const firstSpaceIndex = item.name.indexOf(' ');
            const icon = item.name.substring(0, firstSpaceIndex);
            const text = item.name.substring(firstSpaceIndex + 1);

            menuHtml += `
                <div class="menu-category">
                    <button class="category-title">
                        <span class="category-icon">${icon}</span>
                        <span class="link-text">${text}</span>
                        <svg class="arrow-icon link-text" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                    </button>
                    <ul class="submenu">
                        ${item.children.map(createLink).join('')}
                    </ul>
                </div>`;
        } else {
            menuHtml += `<ul>${createLink(item)}</ul>`;
        }
    });
    nav.innerHTML = menuHtml;

    // Event listener para los enlaces de navegación
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
    
    // Event listener para los acordeones
    nav.querySelectorAll('.category-title').forEach(button => {
        button.addEventListener('click', () => {
            const category = button.parentElement;
            category.classList.toggle('open');
        });
    });
}
// --- FIN DE CAMBIOS ---

function updateActiveLink(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === path);
    });
}

window.addEventListener('popstate', () => loadView(window.location.pathname));
document.addEventListener('DOMContentLoaded', () => loadView(window.location.pathname));