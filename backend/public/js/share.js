// backend/public/js/share.js
// Helper reutilizable para compartir enlaces con fallback robusto.
(function initShareHelper(global) {
    async function copyWithClipboard(url) {
        if (navigator.clipboard && global.isSecureContext) {
            await navigator.clipboard.writeText(url);
            return true;
        }
        return false;
    }

    function copyWithExecCommand(url) {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    }

    async function copyText(text) {
        if (await copyWithClipboard(text)) return true;
        return copyWithExecCommand(text);
    }

    async function shareLink(options = {}) {
        const url = String(options.url || global.location.href || '').trim();
        const title = String(options.title || document.title || 'Compartir enlace').trim();
        const copiedMessage = String(options.copiedMessage || 'Enlace copiado');

        const showCopyFeedback = () => {
            if (typeof options.onCopied === 'function') options.onCopied();
            else global.alert(copiedMessage);
        };

        const openPromptFallback = () => {
            if (typeof options.onPrompt === 'function') options.onPrompt(url);
            else global.prompt('Copia este enlace:', url);
        };

        const fallbackCopy = async () => {
            if (await copyText(url)) {
                showCopyFeedback();
                return;
            }
            openPromptFallback();
        };

        if (navigator.share) {
            try {
                await navigator.share({ title, url });
                if (typeof options.onShared === 'function') options.onShared();
                return true;
            } catch (err) {
                // AbortError ocurre cuando el usuario cancela manualmente.
                if (err && err.name === 'AbortError') return false;
            }
        }

        await fallbackCopy();
        return true;
    }

    const buildShareMeta = () => {
        const url = global.location.href;
        const title = String(global.currentPropertyShareTitle || document.title || 'Alojamiento').trim();
        const subtitle = String(global.currentPropertyShareSubtitle || '').trim();
        const image = String(global.currentPropertyShareImage || '').trim();
        return { url, title, subtitle, image };
    };

    const openShareWindow = (url) => {
        global.open(url, '_blank', 'noopener,noreferrer,width=720,height=720');
    };

    function closeShareModal() {
        const modal = document.getElementById('share-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }

    let toastTimer = null;
    function showShareToast(message, type = 'success') {
        const toast = document.getElementById('share-toast');
        if (!toast) {
            if (type === 'error') global.alert(message || 'No se pudo completar la acción');
            else global.alert(message || 'Acción completada');
            return;
        }
        toast.className = 'pointer-events-none fixed left-1/2 top-5 -translate-x-1/2 z-[75] rounded-xl px-4 py-2 text-sm font-semibold shadow-lg';
        if (type === 'error') {
            toast.classList.add('border', 'border-danger-200', 'bg-danger-50', 'text-danger-800');
        } else {
            toast.classList.add('border', 'border-success-200', 'bg-success-50', 'text-success-800');
        }
        toast.textContent = message || (type === 'error' ? 'No se pudo completar la acción' : 'Acción completada');
        toast.classList.remove('hidden');
        if (toastTimer) global.clearTimeout(toastTimer);
        toastTimer = global.setTimeout(() => toast.classList.add('hidden'), 1800);
    }

    async function handleShareAction(action, meta) {
        const encodedUrl = encodeURIComponent(meta.url);
        const encodedTitle = encodeURIComponent(meta.title);
        switch (action) {
        case 'copy':
            if (await copyText(meta.url)) showShareToast('Enlace copiado');
            else {
                global.prompt('Copia este enlace:', meta.url);
                showShareToast('No se pudo copiar automáticamente', 'error');
            }
            break;
        case 'email':
            global.location.href = `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${meta.title}\n${meta.url}`)}`;
            break;
        case 'whatsapp':
            openShareWindow(`https://wa.me/?text=${encodeURIComponent(`${meta.title} ${meta.url}`)}`);
            break;
        case 'messages':
            global.location.href = `sms:?body=${encodeURIComponent(`${meta.title} ${meta.url}`)}`;
            break;
        case 'messenger':
            openShareWindow(`https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=966242223397117&redirect_uri=${encodedUrl}`);
            break;
        case 'facebook':
            openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
            break;
        case 'twitter':
            openShareWindow(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`);
            break;
        case 'embed': {
            const embedCode = `<a href="${meta.url}" target="_blank" rel="noopener">${meta.title}</a>`;
            if (await copyText(embedCode)) showShareToast('Código para insertar copiado');
            else {
                global.prompt('Copia este código:', embedCode);
                showShareToast('No se pudo copiar automáticamente', 'error');
            }
            break;
        }
        default:
            break;
        }
    }

    function openShareModal(options = {}) {
        const modal = document.getElementById('share-modal');
        if (!modal) {
            shareLink(options);
            return;
        }
        const meta = { ...buildShareMeta(), ...options };
        const titleEl = document.getElementById('share-modal-title');
        const subtitleEl = document.getElementById('share-modal-subtitle');
        const imageEl = document.getElementById('share-modal-image');
        if (titleEl) titleEl.textContent = meta.title;
        if (subtitleEl) subtitleEl.textContent = meta.subtitle || meta.url;
        if (imageEl) {
            imageEl.src = meta.image || 'https://placehold.co/80x80/e5e7eb/9ca3af?text=SM';
            imageEl.onerror = () => { imageEl.src = 'https://placehold.co/80x80/e5e7eb/9ca3af?text=SM'; };
        }
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');

        const actionButtons = modal.querySelectorAll('[data-share-action]');
        actionButtons.forEach((btn) => {
            btn.onclick = async () => {
                await handleShareAction(btn.dataset.shareAction, meta);
            };
        });
    }

    function bindShareModalEvents() {
        const overlay = document.getElementById('share-modal-overlay');
        const closeBtn = document.getElementById('share-modal-close');
        overlay?.addEventListener('click', closeShareModal);
        closeBtn?.addEventListener('click', closeShareModal);
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') closeShareModal();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindShareModalEvents);
    } else {
        bindShareModalEvents();
    }

    global.smShareLink = shareLink;
    global.smOpenShareModal = openShareModal;
    global.smCloseShareModal = closeShareModal;
})(window);
