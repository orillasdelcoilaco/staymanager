// Modal: generar hasta 10 reseñas automáticas (clientes con reserva finalizada sin reseña).

export function renderModalAuto() {
    return `
    <div id="modal-resenas-auto" class="fixed inset-0 bg-black/50 z-50 hidden items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div class="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
                <h3 class="text-base font-semibold text-gray-900">✨ Generar reseñas automáticas</h3>
                <button type="button" id="modal-auto-close" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div class="px-5 py-4 overflow-y-auto flex-1 space-y-3 text-sm text-gray-600">
                <p>Puedes <strong>generar hasta 10 automáticas</strong> sin elegir nadie (toma los primeros candidatos válidos), o marcar hasta <strong>10 clientes</strong>. Las reseñas quedan <strong>publicadas</strong> y con promedio coherente entre <strong>9.3 y 9.7</strong> sobre 10 en la web pública.</p>
                <p class="text-xs text-gray-500">Los textos usan el contexto de tu empresa (wizard/SSR) cuando está disponible.</p>
                <div id="modal-auto-loading" class="text-gray-500 py-6 text-center hidden">Cargando clientes…</div>
                <div id="modal-auto-empty" class="text-warning-700 bg-warning-50 rounded-lg p-3 text-sm hidden"></div>
                <div id="modal-auto-list" class="space-y-1 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-2 hidden"></div>
                <p id="modal-auto-count" class="text-xs text-gray-500 hidden">0 / 10 seleccionados</p>
            </div>
            <div class="flex justify-end flex-wrap gap-2 px-5 py-4 border-t flex-shrink-0">
                <button type="button" id="modal-auto-cancel" class="btn-outline text-sm">Cancelar</button>
                <button type="button" id="modal-auto-submit-all" class="btn-primary text-sm">Generar hasta 10 (automático)</button>
                <button type="button" id="modal-auto-submit" class="btn-outline text-sm" disabled>Generar seleccionados</button>
            </div>
        </div>
    </div>`;
}

export function setupModalAuto(fetchAPI, onDone) {
    const root = document.getElementById('modal-resenas-auto');
    if (!root) return { open: () => {} };

    const listEl = document.getElementById('modal-auto-list');
    const loadingEl = document.getElementById('modal-auto-loading');
    const emptyEl = document.getElementById('modal-auto-empty');
    const countEl = document.getElementById('modal-auto-count');
    const submitBtn = document.getElementById('modal-auto-submit');
    const submitAllBtn = document.getElementById('modal-auto-submit-all');
    const selected = new Set();

    const close = () => {
        root.classList.add('hidden');
        root.classList.remove('flex');
        selected.clear();
        updateCount();
    };

    const updateCount = () => {
        if (countEl) {
            countEl.textContent = `${selected.size} / 10 seleccionados`;
            countEl.classList.remove('hidden');
        }
        if (submitBtn) submitBtn.disabled = selected.size === 0;
    };

    const open = async () => {
        selected.clear();
        updateCount();
        root.classList.remove('hidden');
        root.classList.add('flex');
        loadingEl?.classList.remove('hidden');
        emptyEl?.classList.add('hidden');
        listEl?.classList.add('hidden');
        listEl.innerHTML = '';
        try {
            const rows = await fetchAPI('/resenas/candidatos-auto?limit=100');
            loadingEl?.classList.add('hidden');
            if (!rows?.length) {
                emptyEl.textContent = 'No hay clientes con reservas finalizadas sin reseña. Necesitas reservas confirmadas ya pasadas (fecha de salida).';
                emptyEl.classList.remove('hidden');
                return;
            }
            emptyEl.classList.add('hidden');
            listEl.classList.remove('hidden');
            rows.forEach((r) => {
                const id = String(r.id);
                const row = document.createElement('label');
                row.className = 'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer text-gray-800';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'rounded border-gray-300';
                cb.dataset.clienteId = id;
                cb.addEventListener('change', () => {
                    if (cb.checked) {
                        if (selected.size >= 10 && !selected.has(id)) {
                            cb.checked = false;
                            alert('Máximo 10 clientes.');
                            return;
                        }
                        selected.add(id);
                    } else {
                        selected.delete(id);
                    }
                    updateCount();
                });
                const span = document.createElement('span');
                span.className = 'text-sm flex-1 truncate';
                span.textContent = `${r.nombre || 'Cliente'} · ${r.alojamientoNombre || 'Alojamiento'}`;
                row.appendChild(cb);
                row.appendChild(span);
                listEl.appendChild(row);
            });
        } catch (e) {
            loadingEl?.classList.add('hidden');
            emptyEl.textContent = e.message || 'Error al cargar candidatos.';
            emptyEl.classList.remove('hidden');
        }
    };

    document.getElementById('modal-auto-close')?.addEventListener('click', close);
    document.getElementById('modal-auto-cancel')?.addEventListener('click', close);

    const runGenerar = async (clienteIds) => {
        submitBtn.disabled = true;
        if (submitAllBtn) submitAllBtn.disabled = true;
        submitBtn.textContent = 'Generando…';
        if (submitAllBtn) submitAllBtn.textContent = 'Generando…';
        try {
            await fetchAPI('/resenas/generar-automaticas', {
                method: 'POST',
                body: { clienteIds },
            });
            close();
            if (typeof onDone === 'function') await onDone();
        } catch (e) {
            alert(e.message || 'Error al generar reseñas');
        } finally {
            submitBtn.disabled = selected.size === 0;
            submitBtn.textContent = 'Generar seleccionados';
            if (submitAllBtn) {
                submitAllBtn.disabled = false;
                submitAllBtn.textContent = 'Generar hasta 10 (automático)';
            }
        }
    };

    submitAllBtn?.addEventListener('click', async () => {
        await runGenerar([]);
    });

    submitBtn?.addEventListener('click', async () => {
        if (selected.size === 0) return;
        await runGenerar([...selected]);
    });

    return { open };
}
