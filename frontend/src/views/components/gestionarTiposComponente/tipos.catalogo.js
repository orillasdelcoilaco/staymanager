// tipos.catalogo.js — Búsqueda fuzzy del catálogo universal de activos
import { fetchAPI } from '../../../api.js';

/**
 * Configura el input de búsqueda fuzzy en el wizard de espacios.
 * Requiere que `inventarioTemporal` y `renderInventarioList` estén en scope (pasados como parámetros).
 */
export function setupCatalogoSearch(inventarioTemporal, renderInventarioList) {
    const input = document.getElementById('input-catalogo-busqueda');
    if (!input) return;

    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = input.value.trim();

        if (q.length < 2) {
            document.getElementById('catalogo-resultados').classList.add('hidden');
            document.getElementById('catalogo-crear-nuevo').classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(() => buscarEnCatalogo(q, inventarioTemporal, renderInventarioList), 300);
    });

    document.getElementById('btn-catalogo-crear')?.addEventListener('click', () => {
        const nombre = document.getElementById('catalogo-crear-nombre').textContent.trim();
        if (!nombre) return;
        inventarioTemporal.push({
            tipoId: null,
            nombre,
            icono: '🆕',
            cantidad: 1,
            categoria: 'Otros',
            isNew: true
        });
        renderInventarioList();
        document.getElementById('input-catalogo-busqueda').value = '';
        document.getElementById('catalogo-resultados').classList.add('hidden');
        document.getElementById('catalogo-crear-nuevo').classList.add('hidden');
    });
}

async function buscarEnCatalogo(q, inventarioTemporal, renderInventarioList) {
    const loadingEl  = document.getElementById('catalogo-loading');
    const resultados = document.getElementById('catalogo-resultados');
    const crearNuevo = document.getElementById('catalogo-crear-nuevo');

    loadingEl.classList.remove('hidden');
    resultados.classList.add('hidden');
    crearNuevo.classList.add('hidden');

    try {
        const items = await fetchAPI(`/catalogo/activos?q=${encodeURIComponent(q)}`);

        if (!items || items.length === 0) {
            document.getElementById('catalogo-crear-nombre').textContent = q;
            crearNuevo.classList.remove('hidden');
        } else {
            resultados.innerHTML = items.map(r => `
                <button type="button"
                    class="catalogo-chip catalogo-chip-btn"
                    data-id="${r.id}" data-nombre="${r.nombre}" data-icono="${r.icono || '🔹'}">
                    <span>${r.icono || '🔹'}</span> ${r.nombre}
                </button>
            `).join('');
            resultados.classList.remove('hidden');

            resultados.querySelectorAll('.catalogo-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const id = chip.dataset.id;
                    const existe = inventarioTemporal.find(i => i.tipoId === id);
                    if (existe) {
                        existe.cantidad += 1;
                    } else {
                        inventarioTemporal.push({
                            tipoId: id,
                            nombre: chip.dataset.nombre,
                            icono: chip.dataset.icono,
                            cantidad: 1,
                            isNew: false
                        });
                    }
                    fetchAPI(`/catalogo/activos/${id}/uso`, { method: 'POST' }).catch(() => {});
                    renderInventarioList();
                    document.getElementById('input-catalogo-busqueda').value = '';
                    resultados.classList.add('hidden');
                });
            });

            document.getElementById('catalogo-crear-nombre').textContent = q;
            crearNuevo.classList.remove('hidden');
        }
    } catch (err) {
        console.error('[Catálogo] Error en búsqueda:', err);
    } finally {
        loadingEl.classList.add('hidden');
    }
}
