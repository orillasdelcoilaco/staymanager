// frontend/src/utils/imageEditorModal.js

let cropper = null;
let modalContainer = null;
let onConfirmCallback = null;

const createModalHTML = () => `
    <div id="image-editor-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden" style="z-index: 9999; display: none;">
        <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white" style="margin-top: 5vh; max-height: 90vh;">
            <div class="mt-3 text-center">
                <h3 class="text-lg leading-6 font-medium text-gray-900">Editar Imagen (Recortar/Rotar)</h3>
                <div class="mt-2 px-1 py-3">
                    <div class="img-container bg-gray-100 rounded border flex justify-center items-center overflow-hidden" style="height: 500px; max-height: 60vh;">
                        <img id="image-to-crop" src="" alt="Imagen para editar" style="max-width: 100%; max-height: 100%; display: block;">
                    </div>
                </div>
                <div class="flex justify-center gap-4 mt-4 mb-4">
                    <button type="button" id="btn-rotate-left" class="btn-secondary btn-sm" title="Rotar -90°">🔄 -90°</button>
                    <button type="button" id="btn-rotate-right" class="btn-secondary btn-sm" title="Rotar +90°">🔄 +90°</button>
                    <button type="button" id="btn-reset" class="btn-secondary btn-sm" title="Reiniciar">Reiniciar</button>
                </div>
                <div class="items-center px-4 py-3 flex space-x-4">
                    <button id="btn-cancel-crop" class="btn-secondary w-1/3">
                        Cancelar
                    </button>
                    <button id="btn-confirm-crop" class="btn-primary w-2/3">
                        ✂️ Confirmar Recorte y Usar
                    </button>
                </div>
            </div>
        </div>
    </div>
`;

const initModal = () => {
    if (document.getElementById('image-editor-modal')) {
        modalContainer = document.getElementById('image-editor-modal');
        return;
    }
    
    document.body.insertAdjacentHTML('beforeend', createModalHTML());
    modalContainer = document.getElementById('image-editor-modal');

    document.getElementById('btn-cancel-crop').addEventListener('click', closeEditor);
    document.getElementById('btn-rotate-left').addEventListener('click', () => cropper?.rotate(-90));
    document.getElementById('btn-rotate-right').addEventListener('click', () => cropper?.rotate(90));
    document.getElementById('btn-reset').addEventListener('click', () => cropper?.reset());
    
    document.getElementById('btn-confirm-crop').addEventListener('click', () => {
        if (!cropper) return;
        
        const canvas = cropper.getCroppedCanvas({
            maxWidth: 1920, 
            maxHeight: 1920,
            fillColor: '#fff',
        });

        canvas.toBlob((blob) => {
            if (onConfirmCallback) onConfirmCallback(blob);
            closeEditor();
        }, 'image/jpeg', 0.92);
    });
};

export const openEditor = (imageSource, onConfirm) => {
    if (typeof Cropper === 'undefined') {
        alert('Error: La librería Cropper.js no está cargada. Revisa el index.html.');
        return;
    }

    initModal();
    onConfirmCallback = onConfirm;
    
    const imageElement = document.getElementById('image-to-crop');
    
    const startCropper = (src) => {
        // IMPORTANTE: Configurar CORS antes de establecer el src
        imageElement.crossOrigin = 'anonymous'; 
        imageElement.src = src;
        
        modalContainer.classList.remove('hidden');
        modalContainer.style.display = 'block';
        
        if (cropper) cropper.destroy();
        
        cropper = new Cropper(imageElement, {
            viewMode: 1,
            autoCropArea: 1,
            responsive: true,
            background: false,
            checkCrossOrigin: false, // Ya lo manejamos manualmente
        });
    };

    if (imageSource instanceof File || imageSource instanceof Blob) {
        const reader = new FileReader();
        reader.onload = (e) => startCropper(e.target.result);
        reader.readAsDataURL(imageSource);
    } else if (typeof imageSource === 'string') {
        // FIX DE CORS: Añadir timestamp para evitar caché del navegador
        const separator = imageSource.includes('?') ? '&' : '?';
        const urlWithCacheBust = `${imageSource}${separator}t=${new Date().getTime()}`;
        startCropper(urlWithCacheBust);
    }
};

const closeEditor = () => {
    if (modalContainer) {
        modalContainer.classList.add('hidden');
        modalContainer.style.display = 'none';
    }
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    const img = document.getElementById('image-to-crop');
    if(img) {
        img.src = '';
        img.removeAttribute('crossOrigin');
    }
    onConfirmCallback = null;
};