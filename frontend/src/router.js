// frontend/src/router.js
import { fetchAPI } from './api.js';
import { checkAuthAndRender, renderAppLayout } from './app.js';

const views = {
    '/login': () => import('./views/login.js'),
    '/': () => import('./views/dashboard.js'),
    '/gestion-diaria': () => import('./views/gestionDiaria.js'),
    '/calendario': () => import('./views/calendario.js'),
    '/clientes': () => import('./views/gestionarClientes.js'),
    '/cliente/:id': () => import('./views/perfilCliente.js'),
    '/agregar-propuesta': () => import('./views/agregarPropuesta.js'),
    '/generar-presupuesto': () => import('./views/generadorPresupuestos.js'),
    '/gestionar-tipos-componente': () => import('./views/gestionarTiposComponente.js'), // <-- NUEVA RUTA
    '/gestionar-alojamientos': () => import('./views/gestionarAlojamientos.js'),
    '/gestionar-canales': () => import('./views/gestionarCanales.js'),
    '/gestionar-tarifas': () => import('./views/gestionarTarifas.js'),
    '/gestionar-comentarios': () => import('./views/gestionarComentarios.js'),
    '/conversion-alojamientos': () => import('./views/conversionAlojamientos.js'),
    '/mapeo-reportes': () => import('./views/mapeoReportes.js'),
    '/procesar-y-consolidar': () => import('./views/procesarYConsolidar.js'),
    '/gestionar-reservas': () => import('./views/gestionarReservas.js'),
    '/gestionar-dolar': () => import('./views/gestionarDolar.js'),
    '/gestionar-estados': () => import('./views/gestionarEstados.js'),
    '/reparar-dolar': () => import('./views/repararDolar.js'),
    '/reparar-fechas': () => import('./views/repararFechas.js'),
    '/autorizar-google': () => import('./views/autorizarGoogle.js'),
    '/empresa': () => import('./views/empresa.js'),
    '/gestionar-usuarios': () => import('./views/gestionarUsuarios.js'),
    '/reparar-contactos': () => import('./views/repararContactos.js'),
    '/historial-cargas': () => import('./views/historialCargas.js'),
    '/gestionar-tipos-plantilla': () => import('./views/gestionarTiposPlantilla.js'),
    '/gestionar-plantillas': () => import('./views/gestionarPlantillas.js'),
    '/gestionar-propuestas': () => import('./views/gestionarPropuestas.js'),
    '/generar-reportes-rapidos': () => import('./views/generarReportes.js'),
    '/sincronizar-ical': () => import('./views/sincronizarCalendarios.js'),
    '/crm-promociones': () => import('./views/crmPromociones.js'),
    '/historial-campanas': () => import('./views/historialCampanas.js'),
    '/configurar-web-publica': () => import('./views/configurarWebPublica.js'),
};

const menuConfig = [
    { name: '📊 Dashboard', path: '/', id: 'dashboard' },
    {
        name: '💼 Flujo de Trabajo',
        id: 'flujo-trabajo',
        children: [
            { name: '☀️ Gestión Diaria', path: '/gestion-diaria', id: 'gestion-diaria' },
            { name: '📅 Calendario', path: '/calendario', id: 'calendario' },
            { name: '🎯 CRM y Promociones', path: '/crm-promociones', id: 'crm-promociones' },
            { name: '📈 Historial de Campañas', path: '/historial-campanas', id: 'historial-campanas' },
            { name: '📄 Generar Reportes Rápidos', path: '/generar-reportes-rapidos', id: 'reportes-rapidos' },
            { name: '➕ Agregar Propuesta', path: '/agregar-propuesta', id: 'agregar-propuesta' },
            { name: '💲 Generar Presupuestos', path: '/generar-presupuesto', id: 'generar-presupuestos' },
            { name: '🗂️ Gestionar Propuestas', path: '/gestionar-propuestas', id: 'gestionar-propuestas' },
        ]
    },
    {
        name: '🛠️ Herramientas',
        id: 'herramientas',
        children: [
            { name: '⭐ Gestionar Comentarios', path: '/gestionar-comentarios', id: 'gestionar-comentarios' },
            { name: '⚙️ Procesar y Consolidar', path: '/procesar-y-consolidar', id: 'procesar-consolidar' },
            { name: '🗂️ Historial de Cargas', path: '/historial-cargas', id: 'historial-cargas' },
            { name: '👥 Gestionar Clientes', path: '/clientes', id: 'clientes' },
            { name: '🏨 Gestionar Reservas', path: '/gestionar-reservas', id: 'gestionar-reservas' },
            { name: '📈 Gestionar Tarifas', path: '/gestionar-tarifas', id: 'gestionar-tarifas' },
            { name: '📈 Gestionar Valor Dólar', path: '/gestionar-dolar', id: 'gestionar-dolar' },
            { name: '🏗️ Tipos de Componente', path: '/gestionar-tipos-componente', id: 'gestionar-tipos-componente' }, // <-- NUEVO ITEM
            { name: '🏡 Gestionar Alojamientos', path: '/gestionar-alojamientos', id: 'gestionar-alojamientos' },
            { name: '📡 Gestionar Canales', path: '/gestionar-canales', id: 'gestionar-canales' },
            { name: '🏷️ Tipos de Plantilla', path: '/gestionar-tipos-plantilla', id: 'gestionar-tipos-plantilla' },
            { name: '✉️ Gestionar Plantillas', path: '/gestionar-plantillas', id: 'gestionar-plantillas' },
            { name: '🌐 Configurar Web Pública', path: '/configurar-web-publica', id: 'config-web-publica' },
        ]
    },
    {
        name: '⚙️ Configuración',
        id: 'configuracion',
        children: [
            { name: '🏢 Empresa', path: '/empresa', id: 'config-empresa' },
            { name: '👥 Gestionar Usuarios', path: '/gestionar-usuarios', id: 'config-usuarios' },
            { name: '🗂️ Gestionar Estados', path: '/gestionar-estados', id: 'config-estados' },
            { name: '🔄 Conversión Alojamientos', path: '/conversion-alojamientos', id: 'config-conversion' },
            { name: '🗺️ Mapeo de Reportes', path: '/mapeo-reportes', id: 'mapeo-reportes' },
            { name: '👤 Autorizar Google Contacts', path: '/autorizar-google', id: 'config-google' },
            { name: '🔧 Reparar Fechas de Reservas', path: '/reparar-fechas', id: 'reparar-fechas' },
            { name: '📞 Reparar y Verificar Contactos', path: '/reparar-contactos', id: 'reparar-contactos' },
            { name: '🔧 Reparar Dólar Histórico', path: '/reparar-dolar', id: 'reparar-dolar' },
            { name: '🗓️ Sincronizar Calendarios (iCal)', path: '/sincronizar-ical', id: 'sincronizar-ical' },
        ]
    }
];

async function updatePendingProposalsCount() {
    try {
        const { count } = await fetchAPI('/gestion-propuestas/count');
        const menuLink = document.querySelector('a[data-path="/gestionar-propuestas"]');
        if (menuLink) {
            let badge = menuLink.querySelector('.menu-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'menu-badge';
                menuLink.appendChild(badge);
            }

            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error("Error al obtener el contador de propuestas:", error);
    }
}

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
        if (!document.getElementById('view-content')) {
            // Layout handling if needed
        }

        let cleanPath = path.split('?')[0];
        if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
            cleanPath = cleanPath.slice(0, -1);
        }

        const dynamicRoute = Object.keys(views).find(route => {
            const regex = new RegExp(`^${route.replace(/:\w+/g, '([^/]+)')}$`);
            return regex.test(cleanPath);
        });

        const viewLoader = views[dynamicRoute] || views['/'];
        const viewModule = await viewLoader();

        const viewContentEl = document.getElementById('view-content');
        if (viewContentEl) {
            viewContentEl.innerHTML = await viewModule.render();
        }

        if (viewModule.afterRender && typeof viewModule.afterRender === 'function') {
            viewModule.afterRender();
        }

        updateActiveLink(cleanPath);
    }
}

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

    nav.querySelectorAll('.category-title').forEach(button => {
        button.addEventListener('click', () => {
            const category = button.parentElement;
            if (category) {
                category.classList.toggle('open');
            }
        });
    });

    updatePendingProposalsCount();
}

function updateActiveLink(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === path);
    });
}

window.addEventListener('popstate', () => loadView(window.location.pathname));
document.addEventListener('DOMContentLoaded', () => loadView(window.location.pathname));