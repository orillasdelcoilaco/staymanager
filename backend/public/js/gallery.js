// backend/public/js/gallery.js

document.addEventListener('DOMContentLoaded', () => {
    // Obtener los datos de las imágenes inyectados en propiedad.ejs
    const allImages = window.allPropertyImages || [];
    if (allImages.length === 0) return;

    // Elementos del DOM
    const modal = document.getElementById('lightbox-modal');
    const modalImg = document.getElementById('lightbox-image');
    const modalCaption = document.getElementById('lightbox-caption');
    const btnClose = document.getElementById('lightbox-close');
    const btnPrev = document.getElementById('lightbox-prev');
    const btnNext = document.getElementById('lightbox-next');
    const overlay = document.querySelector('.lightbox-overlay');
    
    // Todos los elementos que abren la galería
    const imageTriggers = document.querySelectorAll('.gallery-image-trigger');

    let currentIndex = 0;

    function showImage(index) {
        if (index < 0 || index >= allImages.length) {
            console.warn(`Índice de galería fuera de rango: ${index}`);
            return;
        }
        
        const imgData = allImages[index];
        if (!imgData || !imgData.storagePath) {
             console.warn(`Datos de imagen inválidos en el índice: ${index}`, imgData);
             return;
        }

        currentIndex = index;
        modalImg.src = imgData.storagePath;
        modalImg.alt = imgData.altText || 'Imagen de galería';
        modalCaption.textContent = imgData.title || `Imagen ${index + 1} de ${allImages.length}`;

        // Ocultar/mostrar botones de navegación en los extremos
        btnPrev.classList.toggle('hidden', index === 0);
        btnNext.classList.toggle('hidden', index === allImages.length - 1);
    }

    function openGallery(index) {
        showImage(index);
        modal.classList.remove('hidden');
        // Capturar foco para navegación por teclado
        modal.focus(); 
    }

    function closeGallery() {
        modal.classList.add('hidden');
    }

    function nextImage() {
        if (currentIndex < allImages.length - 1) {
            showImage(currentIndex + 1);
        }
    }

    function prevImage() {
        if (currentIndex > 0) {
            showImage(currentIndex - 1);
        }
    }

    // --- Asignar Event Listeners ---

    // Abrir galería al hacer clic en una imagen del mosaico
    imageTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que el clic se propague si está anidado
            const index = parseInt(trigger.dataset.index, 10);
            if (!isNaN(index)) {
                openGallery(index);
            }
        });
    });

    // Cerrar modal
    btnClose.addEventListener('click', closeGallery);
    overlay.addEventListener('click', closeGallery);

    // Navegación
    btnNext.addEventListener('click', nextImage);
    btnPrev.addEventListener('click', prevImage);

    // Navegación con teclado (Escape, Flechas)
    document.addEventListener('keydown', (e) => {
        if (modal.classList.contains('hidden')) return; // No hacer nada si el modal está cerrado

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