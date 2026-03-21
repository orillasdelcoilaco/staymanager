// frontend/src/router.js
import { fetchAPI } from './api.js';
import { checkAuthAndRender } from './app.js';

const views = {
    '/login': () => import('./views/login.js'),
    '/': () => import('./views/dashboard.js'),
    '/gestion-diaria': () => import('./views/gestionDiaria.js'),
    '/calendario': () => import('./views/calendario.js'),
    '/clientes': () => import('./views/gestionarClientes.js'),
    '/cliente/:id': () => import('./views/perfilCliente.js'),
    '/agregar-propuesta': () => import('./views/agregarPropuesta.js'),
    '/generar-presupuesto': () => import('./views/generadorPresupuestos.js'),
    '/gestionar-alojamientos': () => import('./views/gestionarAlojamientos.js'),
    '/gestionar-canales': () => import('./views/gestionarCanales.js'),
    '/gestionar-tarifas': () => import('./views/gestionarTarifas.js'),
    '/conversion-alojamientos': () => import('./views/conversionAlojamientos.js'),
    '/mapeo-reportes': () => import('./views/mapeoReportes.js'),
    '/procesar-y-consolidar': () => import('./views/procesarYConsolidar.js'),
    '/gestionar-reservas': () => import('./views/gestionarReservas.js'),
    '/gestionar-dolar': () => import('./views/gestionarDolar.js'),
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

    // --- NUEVAS VISTAS AGREGADAS ---
    '/website-general': () => import('./views/websiteGeneral.js'),
    '/website-alojamientos': () => import('./views/websiteAlojamientos.js'),
    '/gestionar-tipos-componente': () => import('./views/gestionarTiposComponente.js'),
    '/gestionar-tipos-elemento': () => import('./views/gestionarTiposElemento.js?v=1.7'),
    '/gestionar-comentarios': () => import('./views/gestionarComentarios.js'),
    '/importador-magico': () => import('./views/importadorMagico.js?v=1.2'),
    '/galeria-propiedad': () => import('./views/galeriaPropiedad.js'),
};

const menuConfig = [
    { name: '📊 Dashboard', path: '/', id: 'dashboard' },
    {
        name: '💼 Flujo de Trabajo',
        id: 'flujo-trabajo',
        children: [
            { name: '☀️ Gestión Diaria', path: '/gestion-diaria', id: 'gestion-diaria' },
            { name: '📅 Calendario', path: '/calendario', id: 'calendario' },
            { name: '📄 Reportes Rápidos', path: '/generar-reportes-rapidos', id: 'reportes-rapidos' },
            { name: '➕ Agregar Propuesta', path: '/agregar-propuesta', id: 'agregar-propuesta' },
            { name: '💲 Generar Presupuesto', path: '/generar-presupuesto', id: 'generar-presupuestos' },
            { name: '🗂️ Gestionar Propuestas', path: '/gestionar-propuestas', id: 'gestionar-propuestas' },
            { name: '🎯 CRM y Promociones', path: '/crm-promociones', id: 'crm-promociones' },
            { name: '📈 Historial Campañas', path: '/historial-campanas', id: 'historial-campanas' },
        ]
    },
    {
        name: '⚙️ Operaciones',
        id: 'operaciones',
        children: [
            { name: '💬 Comentarios', path: '/gestionar-comentarios', id: 'gestionar-comentarios' },
            { name: '🏨 Reservas', path: '/gestionar-reservas', id: 'gestionar-reservas' },
            { name: '👥 Clientes', path: '/clientes', id: 'clientes' },
            { name: '📈 Tarifas', path: '/gestionar-tarifas', id: 'gestionar-tarifas' },
            { name: '📡 Canales', path: '/gestionar-canales', id: 'gestionar-canales' },
            { name: '🗓️ Sincronizar iCal', path: '/sincronizar-ical', id: 'sincronizar-ical' },
        ]
    },
    {
        name: '🏡 Gestión de Propiedades',
        id: 'gestion-propiedades',
        children: [
            { name: '🧩 Activos', path: '/gestionar-tipos-elemento', id: 'tipos-elemento' },
            { name: '📦 Espacios', path: '/gestionar-tipos-componente', id: 'tipos-componente' },
            { name: '🏨 Alojamientos', path: '/gestionar-alojamientos', id: 'gestionar-alojamientos' },
            { name: '🖼️ Contenido Web', path: '/website-alojamientos', id: 'website-alojamientos' },
            { name: '📷 Galería de Fotos', path: '/galeria-propiedad', id: 'galeria-propiedad' },
            { name: '⚙️ Configuración Web', path: '/website-general', id: 'website-general' },
        ]
    },
    {
        name: '⚙️ Configuración',
        id: 'configuracion',
        children: [
            { name: '🏢 Empresa', path: '/empresa', id: 'config-empresa' },
            { name: '👥 Usuarios', path: '/gestionar-usuarios', id: 'config-usuarios' },
            { name: '✉️ Plantillas', path: '/gestionar-plantillas', id: 'gestionar-plantillas' },
            { name: '💵 Valor Dólar', path: '/gestionar-dolar', id: 'gestionar-dolar' },
            { name: '🔧 Herramientas Avanzadas', path: '/procesar-y-consolidar', id: 'procesar-consolidar' },
            { name: '🗂️ Historial Cargas', path: '/historial-cargas', id: 'historial-cargas' },
            { name: '🔄 Conversión', path: '/conversion-alojamientos', id: 'config-conversion' },
            { name: '🗺️ Mapeo Reportes', path: '/mapeo-reportes', id: 'mapeo-reportes' },
            { name: '👤 Autorizar Google Contacts', path: '/autorizar-google', id: 'config-google' },
            { name: '🔧 Reparar Fechas de Reservas', path: '/reparar-fechas', id: 'reparar-fechas' },
            { name: '📞 Reparar y Verificar Contactos', path: '/reparar-contactos', id: 'reparar-contactos' },
            { name: '🔧 Reparar Dólar Histórico', path: '/reparar-dolar', id: 'reparar-dolar' },
            { name: '🏷️ Tipos de Plantilla', path: '/gestionar-tipos-plantilla', id: 'gestionar-tipos-plantilla' },
            { name: '✨ Importador Mágico', path: '/importador-magico', id: 'importador-magico' },
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
                badge.style.display = 'flex'; // Usar flex para centrar el número
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
        let cleanPath = path.split('?')[0];
        if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
            cleanPath = cleanPath.slice(0, -1);
        }

        const dynamicRoute = Object.keys(views).find(route => {
            const regex = new RegExp(`^${route.replace(/:\w+/g, '([^/]+)')}$`);
            return regex.test(cleanPath);
        });

        try {
            const viewLoader = views[dynamicRoute] || views['/'];
            const viewModule = await viewLoader();

            const viewContentEl = document.getElementById('view-content');
            if (viewContentEl) {
                viewContentEl.innerHTML = await viewModule.render();
            }

            if (viewModule.afterRender && typeof viewModule.afterRender === 'function') {
                viewModule.afterRender();
            }
        } catch (err) {
            console.error(`[Router] Error al cargar vista "${cleanPath}":`, err);
            const viewContentEl = document.getElementById('view-content');
            if (viewContentEl) {
                viewContentEl.innerHTML = `
                    <div class="p-8 text-center">
                        <p class="text-danger-600 font-semibold">Error al cargar la vista</p>
                        <p class="text-sm text-gray-500 mt-1">${err.message}</p>
                    </div>`;
            }
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