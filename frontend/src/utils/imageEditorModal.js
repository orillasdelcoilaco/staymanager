// frontend/src/utils/imageEditorModal.js

let cropper = null;
let modalContainer = null;
let onConfirmCallback = null;

const createModalHTML = () => `
    <div id="image-editor-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
        <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div class="mt-3 text-center">
                <h3 class="text-lg leading-6 font-medium text-gray-900">Editar Imagen</h3>
                <div class="mt-2 px-7 py-3">
                    <div class="img-container h-96 bg-gray-100 rounded border flex justify-center items-center overflow-hidden">
                        <img id="image-to-crop" src="" alt="Imagen para editar" style="max-width: 100%; display: block;">
                    </div>
                </div>
                <div class="flex justify-center gap-4 mt-4 mb-4">
                    <button type="button" id="btn-rotate-left" class="btn-secondary btn-sm" title="Rotar Izquierda -90°">🔄 Izq</button>
                    <button type="button" id="btn-rotate-right" class="btn-secondary btn-sm" title="Rotar Derecha +90°">🔄 Der</button>
                    <button type="button" id="btn-reset" class="btn-secondary btn-sm" title="Reiniciar">Reiniciar</button>
                </div>
                <div class="items-center px-4 py-3">
                    <button id="btn-cancel-crop" class="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 mb-2">
                        Cancelar
                    </button>
                    <button id="btn-confirm-crop" class="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        Confirmar y Usar Imagen
                    </button>
                </div>
            </div>
        </div>
    </div>
`;

const initModal = () => {
    if (document.getElementById('image-editor-modal')) return;
    document.body.insertAdjacentHTML('beforeend', createModalHTML());
    modalContainer = document.getElementById('image-editor-modal');

    document.getElementById('btn-cancel-crop').addEventListener('click', closeEditor);
    document.getElementById('btn-rotate-left').addEventListener('click', () => cropper.rotate(-90));
    document.getElementById('btn-rotate-right').addEventListener('click', () => cropper.rotate(90));
    document.getElementById('btn-reset').addEventListener('click', () => cropper.reset());
    
    document.getElementById('btn-confirm-crop').addEventListener('click', () => {
        if (!cropper) return;
        // Obtener el canvas recortado y convertirlo a blob
        cropper.getCroppedCanvas({
            maxWidth: 1920, // Límite razonable para Full HD
            maxHeight: 1920,
            fillColor: '#fff',
        }).toBlob((blob) => {
            if (onConfirmCallback) onConfirmCallback(blob);
            closeEditor();
        }, 'image/jpeg', 0.9); // Exportar como JPEG de alta calidad
    });
};

export const openEditor = (imageFile, onConfirm) => {
    initModal();
    onConfirmCallback = onConfirm;
    
    const imageElement = document.getElementById('image-to-crop');
    const reader = new FileReader();

    reader.onload = (e) => {
        imageElement.src = e.target.result;
        modalContainer.classList.remove('hidden');
        
        // Destruir instancia previa si existe
        if (cropper) cropper.destroy();
        
        // Inicializar CropperJS
        cropper = new Cropper(imageElement, {
            aspectRatio: NaN, // Permitir cualquier proporción (libre)
            viewMode: 1,      // Restringir el cuadro de recorte dentro del canvas
            autoCropArea: 1,  // El área de recorte cubre toda la imagen al inicio
            responsive: true,
        });
    };
    reader.readAsDataURL(imageFile);
};

const closeEditor = () => {
    modalContainer.classList.add('hidden');
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById('image-to-crop').src = '';
    onConfirmCallback = null;
};