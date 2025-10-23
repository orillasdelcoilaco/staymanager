// backend/public/js/gallery.js

document.addEventListener('DOMContentLoaded', () => {
    // Obtener los datos de las imágenes inyectados en propiedad.ejs
    const allImages = window.allPropertyImages || [];
    if (allImages.length === 0) return;

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

        // *** INICIO LÓGICA DE LOADER ***
        modalLoader.classList.remove('hidden'); // Mostrar loader
        modalImg.classList.add('hidden'); // Ocultar imagen anterior

        // Crear una nueva imagen en memoria para precargar
        const img = new Image();
        img.onload = () => {
            // Una vez cargada, actualizar la imagen real y ocultar el loader
            modalImg.src = imgData.storagePath;
            modalImg.alt = imgData.altText || 'Imagen de galería';
            modalCaption.textContent = imgData.title || `Imagen ${index + 1} de ${allImages.length}`;
            
            modalLoader.classList.add('hidden');
            modalImg.classList.remove('hidden');
        };
        img.onerror = () => {
            // Manejar error si la imagen no carga
            modalLoader.classList.add('hidden');
            modalCaption.textContent = "Error al cargar la imagen.";
        };
        img.src = imgData.storagePath; // Iniciar la carga
        // *** FIN LÓGICA DE LOADER ***

        // Ocultar/mostrar botones de navegación
        btnPrev.classList.toggle('hidden', index === 0);
        btnNext.classList.toggle('hidden', index === allImages.length - 1);
    }

    function openGallery(index) {
        showImage(index);
        modal.classList.remove('hidden');
        modal.focus(); 
    }

    function closeGallery() {
        modal.classList.add('hidden');
        // Detener la carga de la imagen si se cierra
        modalImg.src = ''; 
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

    imageTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(trigger.dataset.index, 10);
            if (!isNaN(index)) {
                openGallery(index);
            }
        });
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