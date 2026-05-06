// Panel: blog del sitio público — prompt local + borrador vía IA externa (pegar JSON) o IA interna (generate-draft).
import { fetchAPI } from '../api.js';

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

async function loadEmpresaSubdomain() {
    try {
        const emp = await fetchAPI('/empresa');
        const sub = emp?.websiteSettings?.general?.subdomain || emp?.subdominio || '';
        return String(sub || '').trim();
    } catch (_) {
        return '';
    }
}

/** HTML de un bloque: tema → prompt → instrucciones → pegar JSON → crear borrador */
function renderTopicCard({ cardId, label, hint, entryType, refPayload }) {
    const refEnc = encodeURIComponent(JSON.stringify(refPayload || {}));
    return `
            <div class="border border-gray-200 rounded-lg p-4 bg-gray-50 blog-topic-card space-y-4"
                 data-card-id="${esc(cardId)}"
                 data-entry-type="${esc(entryType)}"
                 data-ref="${refEnc}">
                ${label ? `<div class="font-medium text-gray-900">${esc(label)}</div>` : ''}
                ${hint ? `<div class="text-sm text-gray-600">${esc(hint)}</div>` : ''}

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tema</label>
                    <input type="text" class="form-input w-full text-sm topic-input"
                        placeholder="Describe el enfoque del artículo (opcional si la sugerencia ya lo define)" />
                </div>

                <div class="flex flex-wrap gap-2 items-center">
                    <button type="button" class="btn-primary text-sm px-3 py-1 gen-prompt-btn">Generar prompt</button>
                    <button type="button" class="btn-outline text-sm px-3 py-1 copy-prompt-btn" disabled>Copiar prompt</button>
                    <label class="text-xs text-gray-600 flex items-center gap-1">
                        <input type="checkbox" class="reel-cb rounded text-primary-600" /> Incluir guion reel en el prompt
                    </label>
                </div>
                <div class="hidden prompt-wrap space-y-2">
                    <label class="block text-sm font-medium text-gray-700">Prompt (cópialo a tu IA externa)</label>
                    <textarea class="form-input w-full text-sm font-mono prompt-preview" readonly rows="8"></textarea>
                </div>

                <div class="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700 space-y-2">
                    <p class="font-medium text-gray-800">Qué hacer</p>
                    <ol class="list-decimal list-inside space-y-1 text-gray-600">
                        <li>Pulsa <strong>Generar prompt</strong> (aquí no se llama a ninguna IA; solo se arma el texto).</li>
                        <li><strong>Copiar prompt</strong> y pégalo en ChatGPT, Gemini u otra IA.</li>
                        <li>Pide que responda <strong>solo con JSON válido</strong>, sin markdown ni texto alrededor (si envuelve en <code class="text-xs bg-gray-100 px-1 rounded">\`\`\`json</code> también sirve).</li>
                        <li>Pega la respuesta en el campo de abajo y pulsa <strong>Crear borrador desde pegado</strong>.</li>
                        <li class="pt-1"><strong>O bien</strong> usa <strong>Generar borrador (IA interna)</strong>: SuiteManager llama al modelo (sujeto a límites de uso del panel).</li>
                    </ol>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Respuesta de la IA (JSON pegado)</label>
                    <textarea class="form-input w-full text-sm font-mono pasted-ai-input" rows="10"
                        placeholder='Pega aquí el JSON con title, bodyHtml, slug, metaDescription, excerpt, faq, reelScript…'></textarea>
                </div>

                <div class="flex flex-wrap gap-2 items-center pt-1 border-t border-gray-200">
                    <button type="button" class="btn-success text-sm px-3 py-1 create-from-paste-btn">Crear borrador desde pegado</button>
                    <button type="button" class="btn-outline text-sm px-3 py-1 internal-ia-btn"
                        title="Usa la IA interna solo del blog (variables BLOG_INTERNAL_* en el servidor). Límite de frecuencia del panel puede aplicar.">
                        Generar borrador (IA interna)
                    </button>
                </div>
            </div>`;
}

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-6 max-w-5xl mx-auto">
            <div class="border-b pb-4">
                <h2 class="text-2xl font-semibold text-gray-900">Blog del sitio público</h2>
                <p class="text-gray-500 mt-1">Sugerencias según promociones, cupones y datos del sistema. <strong>IA externa:</strong> copiar prompt → pegar JSON. <strong>IA interna del blog:</strong> ruta y claves dedicadas (<code class="text-xs bg-gray-100 px-1 rounded">BLOG_INTERNAL_*</code> en el servidor), independientes del resto de IA del panel.</p>
                <p id="blog-public-url" class="text-sm text-primary-600 mt-2 font-mono"></p>
            </div>
            <div id="blog-root" class="flex justify-center py-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    const root = document.getElementById('blog-root');
    const urlEl = document.getElementById('blog-public-url');
    const sub = await loadEmpresaSubdomain();
    if (urlEl && sub) {
        urlEl.textContent = `URL pública del blog: https://${sub}.suitemanagers.com/blog`;
    }

    /** @type {Record<string, string>} */
    let promptByCardId = {};

    const renderPosts = (posts, suggestions) => {
        promptByCardId = {};

        const freeformHtml = renderTopicCard({
            cardId: 'freeform',
            label: 'Nueva entrada (tema libre)',
            hint: 'Define el tema, genera el prompt y completa el flujo con tu IA favorita.',
            entryType: 'freeform',
            refPayload: {},
        });

        const sugHtml = (suggestions || []).map((s, i) => renderTopicCard({
            cardId: `sug-${i}`,
            label: s.label,
            hint: s.hint,
            entryType: s.entryType || 'freeform',
            refPayload: s.refPayload || {},
        })).join('');

        const postsHtml = (posts || []).map((p) => {
            const st = p.status === 'published' ? 'Publicada' : 'Borrador';
            const badge = p.status === 'published'
                ? 'bg-success-100 text-success-800'
                : 'bg-warning-100 text-warning-800';
            return `
            <tr>
                <td class="px-3 py-2 text-sm font-medium text-gray-900">${esc(p.title)}</td>
                <td class="px-3 py-2 text-sm text-gray-600">${esc(p.slug)}</td>
                <td class="px-3 py-2"><span class="text-xs px-2 py-0.5 rounded ${badge}">${st}</span></td>
                <td class="px-3 py-2 text-sm text-right space-x-2">
                    ${p.status !== 'published'
                        ? `<button type="button" class="btn-success text-xs px-2 py-1 pub-btn" data-id="${esc(p.id)}">Publicar</button>`
                        : ''}
                    <button type="button" class="btn-outline text-xs px-2 py-1 unp-btn" data-id="${esc(p.id)}">Borrador</button>
                </td>
            </tr>
        `;
        }).join('');

        root.innerHTML = `
            <div class="w-full space-y-8">
                <section>
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">Nueva entrada</h3>
                    <div class="space-y-3">${freeformHtml}</div>
                </section>
                <section>
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">Sugerencias de temas</h3>
                    <div class="space-y-3">${sugHtml || '<p class="text-gray-500 text-sm">No hay sugerencias automáticas.</p>'}</div>
                </section>
                <section>
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">Entradas</h3>
                    <div class="overflow-x-auto border border-gray-200 rounded-lg">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50"><tr>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Título</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Slug</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500">Acciones</th>
                            </tr></thead>
                            <tbody class="divide-y divide-gray-100 bg-white">${postsHtml || '<tr><td colspan="4" class="px-3 py-6 text-center text-gray-500">Sin entradas. Crea un borrador con el flujo de arriba.</td></tr>'}</tbody>
                        </table>
                    </div>
                </section>
            </div>
        `;

        function readCardPayload(card) {
            const entryType = card.getAttribute('data-entry-type') || 'freeform';
            let refPayload = {};
            try {
                refPayload = JSON.parse(decodeURIComponent(card.getAttribute('data-ref') || '%7B%7D'));
            } catch (_) {}
            const userTopic = card.querySelector('.topic-input')?.value?.trim() || '';
            const includeReelScript = !!card.querySelector('.reel-cb')?.checked;
            const cardId = card.getAttribute('data-card-id') || '';
            return { entryType, refPayload, userTopic, includeReelScript, cardId };
        }

        root.querySelectorAll('.gen-prompt-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const card = btn.closest('.blog-topic-card');
                if (!card) return;
                const { entryType, refPayload, userTopic, includeReelScript, cardId } = readCardPayload(card);
                const copyBtn = card.querySelector('.copy-prompt-btn');
                const wrap = card.querySelector('.prompt-wrap');
                const ta = card.querySelector('.prompt-preview');
                btn.disabled = true;
                try {
                    const data = await fetchAPI('/website/blog/prompt-for-draft', {
                        method: 'POST',
                        body: { entryType, refPayload, userTopic, includeReelScript },
                    });
                    const prompt = data.prompt || '';
                    promptByCardId[cardId] = prompt;
                    if (ta) ta.value = prompt;
                    if (wrap) wrap.classList.remove('hidden');
                    if (copyBtn) copyBtn.disabled = !prompt.length;
                } catch (e) {
                    alert(e.message || 'Error al generar el prompt');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        root.querySelectorAll('.copy-prompt-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const card = btn.closest('.blog-topic-card');
                if (!card) return;
                const cardId = card.getAttribute('data-card-id') || '';
                const text = promptByCardId[cardId] || card.querySelector('.prompt-preview')?.value || '';
                if (!text) return;
                try {
                    await navigator.clipboard.writeText(text);
                } catch (_) {
                    try {
                        card.querySelector('.prompt-preview')?.select();
                        document.execCommand('copy');
                    } catch (e2) {
                        alert('No se pudo copiar. Selecciona el texto del prompt manualmente.');
                        return;
                    }
                }
            });
        });

        root.querySelectorAll('.create-from-paste-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const card = btn.closest('.blog-topic-card');
                if (!card) return;
                const pastedText = card.querySelector('.pasted-ai-input')?.value || '';
                const { entryType, refPayload, userTopic, includeReelScript } = readCardPayload(card);
                btn.disabled = true;
                try {
                    await fetchAPI('/website/blog/posts/from-external-ai', {
                        method: 'POST',
                        body: {
                            entryType,
                            refPayload,
                            userTopic,
                            includeReelScript,
                            pastedText,
                        },
                    });
                    const [p2, s2] = await Promise.all([
                        fetchAPI('/website/blog/posts'),
                        fetchAPI('/website/blog/suggestions'),
                    ]);
                    renderPosts(p2.posts, s2.suggestions);
                } catch (e) {
                    alert(e.message || 'Error al crear el borrador');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        root.querySelectorAll('.internal-ia-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const card = btn.closest('.blog-topic-card');
                if (!card) return;
                const { entryType, refPayload, userTopic, includeReelScript } = readCardPayload(card);
                btn.disabled = true;
                try {
                    await fetchAPI('/website/blog/internal/generate-draft', {
                        method: 'POST',
                        body: { entryType, refPayload, userTopic, includeReelScript },
                    });
                    const [p2, s2] = await Promise.all([
                        fetchAPI('/website/blog/posts'),
                        fetchAPI('/website/blog/suggestions'),
                    ]);
                    renderPosts(p2.posts, s2.suggestions);
                } catch (e) {
                    alert(e.message || 'Error al generar con IA interna');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        root.querySelectorAll('.pub-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                btn.disabled = true;
                try {
                    await fetchAPI(`/website/blog/posts/${id}`, {
                        method: 'PATCH',
                        body: { status: 'published' },
                    });
                    const [p2, s2] = await Promise.all([
                        fetchAPI('/website/blog/posts'),
                        fetchAPI('/website/blog/suggestions'),
                    ]);
                    renderPosts(p2.posts, s2.suggestions);
                } catch (e) {
                    alert(e.message || 'Error');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        root.querySelectorAll('.unp-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                btn.disabled = true;
                try {
                    await fetchAPI(`/website/blog/posts/${id}`, {
                        method: 'PATCH',
                        body: { status: 'draft' },
                    });
                    const [p2, s2] = await Promise.all([
                        fetchAPI('/website/blog/posts'),
                        fetchAPI('/website/blog/suggestions'),
                    ]);
                    renderPosts(p2.posts, s2.suggestions);
                } catch (e) {
                    alert(e.message || 'Error');
                } finally {
                    btn.disabled = false;
                }
            });
        });
    };

    try {
        const [pr, su] = await Promise.all([
            fetchAPI('/website/blog/posts'),
            fetchAPI('/website/blog/suggestions'),
        ]);
        renderPosts(pr.posts, su.suggestions);
    } catch (e) {
        if (root) root.innerHTML = `<p class="text-danger-600">Error: ${esc(e.message)}</p>`;
    }
}
