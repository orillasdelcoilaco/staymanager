// backend/public/js/gallery.js

/**
 * Carrusel móvil (scroll-snap) en ficha de propiedad: dots, contador y flechas.
 */
function initMobilePropertyCarousel() {
    const track = document.getElementById('sm-gallery-track');
    if (!track) return;

    const prev = document.getElementById('sm-gallery-prev');
    const next = document.getElementById('sm-gallery-next');
    const counter = document.getElementById('sm-gallery-counter');
    const dotsWrap = document.getElementById('sm-gallery-dots');

    const slideWidth = () => track.clientWidth || 1;
    const getSlides = () => [...track.querySelectorAll('.sm-gallery-slide')];
    const getDots = () => [...document.querySelectorAll('#sm-gallery-dots .sm-gallery-dot')];

    const updateUi = () => {
        const slides = getSlides();
        const dots = getDots();
        if (slides.length === 0) {
            if (counter) counter.textContent = '0 / 0';
            if (prev) prev.classList.add('hidden');
            if (next) next.classList.add('hidden');
            return;
        }
        const w = slideWidth();
        const i = Math.round(track.scrollLeft / w);
        const last = Math.max(0, slides.length - 1);
        const clamped = Math.max(0, Math.min(i, last));
        dots.forEach((d, k) => d.classList.toggle('is-active', k === clamped));
        if (counter) {
            counter.textContent = `${clamped + 1} / ${Math.max(1, dots.length)}`;
        }
        if (prev) {
            prev.classList.toggle('hidden', slides.length < 2);
            prev.classList.toggle('opacity-40', clamped <= 0);
        }
        if (next) {
            next.classList.toggle('hidden', slides.length < 2);
            next.classList.toggle('opacity-40', clamped >= last);
        }
        if (dotsWrap) {
            dotsWrap.classList.toggle('hidden', dots.length < 2);
        }
    };

    let scrollTick = 0;
    track.addEventListener(
        'scroll',
        () => {
            cancelAnimationFrame(scrollTick);
            scrollTick = requestAnimationFrame(updateUi);
        },
        { passive: true }
    );

    prev?.addEventListener('click', () => {
        track.scrollBy({ left: -slideWidth(), behavior: 'smooth' });
    });
    next?.addEventListener('click', () => {
        track.scrollBy({ left: slideWidth(), behavior: 'smooth' });
    });

    window.__refreshMobilePropertyCarousel = updateUi;
    updateUi();
}

document.addEventListener('DOMContentLoaded', () => {
    initMobilePropertyCarousel();
    const galleryRoot = document.getElementById('property-gallery-root');

    const INLINE_FALLBACK_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    const normalizeStoragePath = (path) => String(path || '').trim();
    const rawImages = Array.isArray(window.allPropertyImages) ? window.allPropertyImages : [];
    const originalImages = rawImages.filter((img) => img && normalizeStoragePath(img.storagePath));
    let allImages = [...originalImages];

    const syncGlobalImages = () => {
        window.allPropertyImages = allImages;
    };
    const removeImageByPath = (storagePath) => {
        const target = normalizeStoragePath(storagePath);
        if (!target) return false;
        const before = allImages.length;
        allImages = allImages.filter((img) => normalizeStoragePath(img.storagePath) !== target);
        if (allImages.length !== before) {
            syncGlobalImages();
            return true;
        }
        return false;
    };
    const mapServerIndexToCurrent = (serverIndex) => {
        const original = originalImages[serverIndex];
        if (!original) return -1;
        const path = normalizeStoragePath(original.storagePath);
        return allImages.findIndex((img) => normalizeStoragePath(img.storagePath) === path);
    };
    const collapseBrokenImageBlock = (imgEl, serverIndex) => {
        if (!galleryRoot || !galleryRoot.contains(imgEl)) return;
        const slide = imgEl.closest('.sm-gallery-slide');
        if (slide) {
            const slideTrack = slide.parentElement;
            const slideIdx = slideTrack ? [...slideTrack.children].indexOf(slide) : -1;
            slide.remove();

            const dotsWrap = document.getElementById('sm-gallery-dots');
            if (dotsWrap && slideIdx >= 0) {
                const dot = dotsWrap.querySelector(`.sm-gallery-dot[data-dot="${slideIdx}"]`);
                if (dot) dot.remove();
                [...dotsWrap.querySelectorAll('.sm-gallery-dot')].forEach((d, idx) => {
                    d.dataset.dot = String(idx);
                });
            }
            if (typeof window.__refreshMobilePropertyCarousel === 'function') {
                window.__refreshMobilePropertyCarousel();
            }
            return;
        }

        if (!isNaN(serverIndex)) {
            const allTriggers = galleryRoot.querySelectorAll(`.gallery-image-trigger[data-index="${serverIndex}"]`);
            allTriggers.forEach((node) => {
                const container = node.closest('.overflow-hidden')
                    || (node.closest('[data-index]') !== node ? node.closest('[data-index]') : null);
                if (container) {
                    container.remove();
                }
            });
            return;
        }

        const container = imgEl.closest('.overflow-hidden');
        if (container) container.remove();
    };
    const handleBrokenInlineImage = (imgEl) => {
        const idxOwn = parseInt(imgEl.dataset.index || '', 10);
        const idxClosest = parseInt(imgEl.closest('[data-index]')?.dataset.index || '', 10);
        const serverIndex = !isNaN(idxOwn) ? idxOwn : idxClosest;
        let brokenPath = normalizeStoragePath(imgEl.currentSrc || imgEl.src);
        if (!brokenPath && !isNaN(serverIndex)) {
            brokenPath = normalizeStoragePath(originalImages[serverIndex]?.storagePath);
        }
        if (brokenPath) removeImageByPath(brokenPath);

        imgEl.onerror = null;
        imgEl.src = INLINE_FALLBACK_SRC;
        imgEl.alt = 'Imagen no disponible';
        collapseBrokenImageBlock(imgEl, serverIndex);
    };

    syncGlobalImages();

    const spotlightBuckets = Array.isArray(window.__spotlightPhotoBuckets) ? window.__spotlightPhotoBuckets : [];
    const hasSpotlightPhotos = spotlightBuckets.some((b) => Array.isArray(b) && b.length > 0);

    // Elementos del DOM
    const modal = document.getElementById('lightbox-modal');
    const modalImg = document.getElementById('lightbox-image');
    const modalCaption = document.getElementById('lightbox-caption');
    const modalLoader = document.getElementById('lightbox-loader'); // Loader
    const btnClose = document.getElementById('lightbox-close');
    const btnPrev = document.getElementById('lightbox-prev');
    const btnNext = document.getElementById('lightbox-next');
    const overlay = document.querySelector('.lightbox-overlay');
    
    // Validar que todos los elementos existan
    if (!modal || !modalImg || !modalCaption || !modalLoader || !btnClose || !btnPrev || !btnNext || !overlay) {
        console.error('Error al inicializar la galería: Faltan elementos del DOM.');
        return;
    }

    if (allImages.length === 0 && !hasSpotlightPhotos) return;

    /** null = galería completa de la propiedad; si es array, solo esas fotos (p. ej. un espacio de destacados) */
    let spotlightView = null;
    const viewList = () => (spotlightView != null ? spotlightView : allImages);

    const imageTriggers = document.querySelectorAll('.gallery-image-trigger');
    let currentIndex = 0;

    function showImage(index, failedPaths = new Set()) {
        const list = viewList();
        if (index < 0 || index >= list.length) {
            console.warn(`Índice de galería fuera de rango: ${index}`);
            return;
        }
        
        const imgData = list[index];
        if (!imgData || !imgData.storagePath) {
             console.warn(`Datos de imagen inválidos en el índice: ${index}`, imgData);
             return;
        }

        currentIndex = index;

        // *** INICIO LÓGICA DE LOADER ***
        modalLoader.classList.remove('hidden'); // Mostrar loader
        modalImg.classList.add('hidden'); // Ocultar imagen anterior

        // Crear una nueva imagen en memoria para precargar
        const img = new Image();
        img.onload = () => {
            // Una vez cargada, actualizar la imagen real y ocultar el loader
            modalImg.src = imgData.storagePath;
            modalImg.alt = imgData.altText || 'Imagen de galería';
            modalCaption.textContent = imgData.title || `Imagen ${index + 1} de ${list.length}`;
            
            modalLoader.classList.add('hidden');
            modalImg.classList.remove('hidden');
        };
        img.onerror = () => {
            const brokenPath = normalizeStoragePath(imgData.storagePath);
            if (spotlightView) {
                spotlightView = spotlightView.filter((x) => normalizeStoragePath(x.storagePath) !== brokenPath);
                failedPaths.add(brokenPath);
                if (!spotlightView.length) {
                    modalLoader.classList.add('hidden');
                    modalImg.classList.add('hidden');
                    modalCaption.textContent = 'No hay imágenes disponibles.';
                    btnPrev.classList.add('hidden');
                    btnNext.classList.add('hidden');
                    return;
                }
            } else if (brokenPath) {
                removeImageByPath(brokenPath);
                failedPaths.add(brokenPath);
            }
            if (allImages.length === 0 && (!spotlightView || spotlightView.length === 0)) {
                modalLoader.classList.add('hidden');
                modalImg.classList.add('hidden');
                modalCaption.textContent = 'No hay imágenes disponibles.';
                btnPrev.classList.add('hidden');
                btnNext.classList.add('hidden');
                return;
            }
            const L = viewList();
            const retryIndex = Math.min(index, Math.max(0, L.length - 1));
            const retryPath = normalizeStoragePath(L[retryIndex]?.storagePath);
            if (retryPath && failedPaths.has(retryPath)) {
                modalLoader.classList.add('hidden');
                modalImg.classList.add('hidden');
                modalCaption.textContent = 'No hay imágenes disponibles.';
                btnPrev.classList.add('hidden');
                btnNext.classList.add('hidden');
                return;
            }
            showImage(retryIndex, failedPaths);
        };
        img.src = imgData.storagePath; // Iniciar la carga
        // *** FIN LÓGICA DE LOADER ***

        // Ocultar/mostrar botones de navegación
        btnPrev.classList.toggle('hidden', index === 0);
        btnNext.classList.toggle('hidden', index === list.length - 1);
    }

    function openGallery(index) {
        spotlightView = null;
        showImage(index);
        modal.classList.remove('hidden');
        modal.focus(); 
    }

    function openSpotlightGallery(bucketIndex, startPathEnc) {
        const raw = spotlightBuckets[bucketIndex];
        if (!Array.isArray(raw) || !raw.length) return;
        const list = raw
            .map((x) => ({
                storagePath: normalizeStoragePath(x.storagePath),
                altText: x.altText || '',
                title: x.title || '',
            }))
            .filter((x) => x.storagePath);
        if (!list.length) return;
        let start = 0;
        try {
            const dec = startPathEnc ? decodeURIComponent(startPathEnc) : '';
            const hit = list.findIndex((x) => x.storagePath === normalizeStoragePath(dec));
            if (hit >= 0) start = hit;
        } catch (_) { /* ignore */ }
        spotlightView = list;
        showImage(start);
        modal.classList.remove('hidden');
        modal.focus();
    }

    function closeGallery() {
        modal.classList.add('hidden');
        spotlightView = null;
        // Detener la carga de la imagen si se cierra
        modalImg.src = ''; 
    }

    function nextImage() {
        const L = viewList();
        if (currentIndex < L.length - 1) {
            showImage(currentIndex + 1);
        }
    }

    function prevImage() {
        if (currentIndex > 0) {
            showImage(currentIndex - 1);
        }
    }

    // --- Asignar Event Listeners ---

    imageTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const serverIndex = parseInt(trigger.dataset.index, 10);
            if (!isNaN(serverIndex)) {
                const liveIndex = mapServerIndexToCurrent(serverIndex);
                if (liveIndex >= 0) {
                    openGallery(liveIndex);
                }
            }
        });
    });

    document.querySelectorAll('.spotlight-lb-trigger').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const bi = parseInt(el.dataset.bucketIndex, 10);
            if (Number.isNaN(bi)) return;
            openSpotlightGallery(bi, el.dataset.startPath || '');
        });
    });

    const inlineGalleryImages = galleryRoot
        ? galleryRoot.querySelectorAll('img[data-index], [data-index] img')
        : [];
    inlineGalleryImages.forEach((imgEl) => {
        if (imgEl.dataset.galleryErrorBound === '1') return;
        imgEl.dataset.galleryErrorBound = '1';
        imgEl.addEventListener('error', () => {
            handleBrokenInlineImage(imgEl);
        });
        // Si la imagen ya falló antes de bindear listeners, la colapsamos igual.
        if (imgEl.complete && imgEl.naturalWidth === 0) {
            handleBrokenInlineImage(imgEl);
        }
    });

    btnClose.addEventListener('click', closeGallery);
    overlay.addEventListener('click', closeGallery);

    btnNext.addEventListener('click', nextImage);
    btnPrev.addEventListener('click', prevImage);

    document.addEventListener('keydown', (e) => {
        if (modal.classList.contains('hidden')) return;

        if (e.key === 'Escape') {
            closeGallery();
        }
        if (e.key === 'ArrowRight') {
            nextImage();
        }
        if (e.key === 'ArrowLeft') {
            prevImage();
        }
    });
});