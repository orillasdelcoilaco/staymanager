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
    '/autorizar-google': () => import('./views/autorizarGoogle.js?v=2'),
    '/empresa': () => import('./views/empresa.js'),
    '/gestionar-usuarios': () => import('./views/gestionarUsuarios.js'),
    '/historial-cargas': () => import('./views/historialCargas.js'),
    '/gestionar-tipos-plantilla': () => import('./views/gestionarTiposPlantilla.js'),
    '/gestionar-plantillas': () => import('./views/gestionarPlantillas.js'),
    '/gestionar-propuestas': () => import('./views/gestionarPropuestas.js'),
    '/generar-reportes-rapidos': () => import('./views/generarReportes.js'),
    '/sincronizar-ical': () => import('./views/sincronizarCalendarios.js'),
    '/crm': () => import('./views/crm.js'),
    '/crm-promociones': () => import('./views/crm.js'),
    '/historial-campanas': () => import('./views/crm.js'),

    // --- NUEVAS VISTAS AGREGADAS ---
    '/website-general': () => import('./views/websiteGeneral.js'),
    '/normas-alojamiento': () => import('./views/normasAlojamiento.js'),
    '/website-alojamientos': () => import('./views/websiteAlojamientos.js'),
    '/gestionar-tipos-componente': () => import('./views/gestionarTiposComponente.js'),
    '/gestionar-tipos-elemento': () => import('./views/gestionarTiposElemento.js?v=1.7'),
    '/importador-magico': () => import('./views/importadorMagico.js?v=1.2'),
    '/galeria-propiedad': () => import('./views/galeriaPropiedad.js'),
    '/espacios-comunes': () => import('./views/espaciosComunes.js'),
    '/mapeos-centrales': () => import('./views/mapeosCentrales.js'),
    '/gestionar-estados': () => import('./views/gestionarEstados.js'),
    '/importador-historico': () => import('./views/importadorHistorico.js'),
    '/gestionar-bloqueos': () => import('./views/gestionarBloqueos.js'),
    '/resenas': () => import('./views/resenas.js'),
};

const menuConfig = [
    { icon: 'fa-solid fa-gauge-high', name: 'Dashboard', path: '/', id: 'dashboard' },
    {
        icon: 'fa-solid fa-briefcase', name: 'Flujo de Trabajo',
        id: 'flujo-trabajo',
        children: [
            { icon: 'fa-solid fa-sun',                  name: 'Gestión Diaria',      path: '/gestion-diaria',          id: 'gestion-diaria' },
            { icon: 'fa-solid fa-calendar',             name: 'Calendario',          path: '/calendario',              id: 'calendario' },
            { icon: 'fa-solid fa-chart-bar',            name: 'Reportes Rápidos',    path: '/generar-reportes-rapidos', id: 'reportes-rapidos' },
            { icon: 'fa-solid fa-plus',                 name: 'Agregar Propuesta',   path: '/agregar-propuesta',       id: 'agregar-propuesta' },
            { icon: 'fa-solid fa-file-invoice-dollar',  name: 'Generar Presupuesto', path: '/generar-presupuesto',     id: 'generar-presupuestos' },
            { icon: 'fa-solid fa-folder-open',          name: 'Gestionar Propuestas',path: '/gestionar-propuestas',    id: 'gestionar-propuestas' },
            { icon: 'fa-solid fa-bullseye',             name: 'CRM',                 path: '/crm',                     id: 'crm' },
        ]
    },
    {
        icon: 'fa-solid fa-gears', name: 'Operaciones',
        id: 'operaciones',
        children: [
            { icon: 'fa-solid fa-star',             name: 'Reseñas',          path: '/resenas',              id: 'resenas' },
            { icon: 'fa-solid fa-bed',              name: 'Reservas',         path: '/gestionar-reservas',   id: 'gestionar-reservas' },
            { icon: 'fa-solid fa-users',            name: 'Clientes',         path: '/clientes',             id: 'clientes' },
            { icon: 'fa-solid fa-chart-line',       name: 'Tarifas',          path: '/gestionar-tarifas',    id: 'gestionar-tarifas' },
            { icon: 'fa-solid fa-tower-broadcast',  name: 'Canales',          path: '/gestionar-canales',    id: 'gestionar-canales' },
            { icon: 'fa-solid fa-calendar-days',    name: 'Sincronizar iCal', path: '/sincronizar-ical',     id: 'sincronizar-ical' },
            { icon: 'fa-solid fa-lock',             name: 'Bloqueos',         path: '/gestionar-bloqueos',   id: 'gestionar-bloqueos' },
        ]
    },
    {
        icon: 'fa-solid fa-house', name: 'Gestión de Propiedades',
        id: 'gestion-propiedades',
        children: [
            { icon: 'fa-solid fa-puzzle-piece',  name: 'Activos',           path: '/gestionar-tipos-elemento',   id: 'tipos-elemento' },
            { icon: 'fa-solid fa-box',           name: 'Espacios',          path: '/gestionar-tipos-componente', id: 'tipos-componente' },
            { icon: 'fa-solid fa-tree',          name: 'Espacios Comunes',  path: '/espacios-comunes',           id: 'espacios-comunes' },
            { icon: 'fa-solid fa-building',      name: 'Alojamientos',      path: '/gestionar-alojamientos',     id: 'gestionar-alojamientos' },
            { icon: 'fa-solid fa-images',        name: 'Galería de Fotos',  path: '/galeria-propiedad',          id: 'galeria-propiedad' },
            { icon: 'fa-solid fa-list-check',    name: 'Normas del alojamiento', path: '/normas-alojamiento', id: 'normas-alojamiento' },
            { icon: 'fa-solid fa-pen-to-square', name: 'Contenido Web',     path: '/website-alojamientos',       id: 'website-alojamientos' },
            { icon: 'fa-solid fa-sliders',       name: 'Configuración Web', path: '/website-general',            id: 'website-general' },
        ]
    },
    {
        icon: 'fa-solid fa-gear', name: 'Configuración',
        id: 'configuracion',
        children: [
            { icon: 'fa-solid fa-building-columns', name: 'Empresa',                  path: '/empresa',                      id: 'config-empresa' },
            { icon: 'fa-solid fa-users-gear',       name: 'Usuarios',                 path: '/gestionar-usuarios',           id: 'config-usuarios' },
            { icon: 'fa-solid fa-envelope',         name: 'Plantillas',               path: '/gestionar-plantillas',         id: 'gestionar-plantillas' },
            { icon: 'fa-solid fa-dollar-sign',      name: 'Valor Dólar',              path: '/gestionar-dolar',              id: 'gestionar-dolar' },
            { icon: 'fa-solid fa-wrench',           name: 'Herramientas Avanzadas',   path: '/procesar-y-consolidar',        id: 'procesar-consolidar' },
            { icon: 'fa-solid fa-clock-rotate-left',name: 'Historial Cargas',         path: '/historial-cargas',             id: 'historial-cargas' },
            { icon: 'fa-solid fa-rotate',           name: 'Conversión',               path: '/conversion-alojamientos',      id: 'config-conversion' },
            { icon: 'fa-solid fa-map',              name: 'Mapeo Reportes',           path: '/mapeo-reportes',               id: 'mapeo-reportes' },
            { icon: 'fa-solid fa-globe',            name: 'Mapeos OTA Centrales',     path: '/mapeos-centrales',             id: 'mapeos-centrales' },
            { icon: 'fa-solid fa-address-book',     name: 'Autorizar Google Contacts',path: '/autorizar-google',             id: 'config-google' },
            { icon: 'fa-solid fa-tag',              name: 'Tipos de Plantilla',       path: '/gestionar-tipos-plantilla',    id: 'gestionar-tipos-plantilla' },
            { icon: 'fa-solid fa-bookmark',         name: 'Estados de Gestión',       path: '/gestionar-estados',            id: 'gestionar-estados' },
            { icon: 'fa-solid fa-wand-magic-sparkles', name: 'Importador Mágico',     path: '/importador-magico',            id: 'importador-magico' },
            { icon: 'fa-solid fa-file-import',      name: 'Importador Histórico',     path: '/importador-historico',         id: 'importador-historico' },
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
        return `<li><a href="${item.path}" class="nav-link" data-path="${item.path}"><i class="${item.icon} nav-icon"></i><span class="link-text">${item.name}</span></a></li>`;
    };

    menuConfig.forEach(item => {
        if (item.children) {
            menuHtml += `
                <div class="menu-category">
                    <button class="category-title">
                        <span class="category-icon"><i class="${item.icon}"></i></span>
                        <span class="link-text">${item.name}</span>
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

function initialAppPath() {
    const q = window.location.search || '';
    return `${window.location.pathname}${q}`;
}

window.addEventListener('popstate', () => loadView(initialAppPath()));
document.addEventListener('DOMContentLoaded', () => loadView(initialAppPath()));