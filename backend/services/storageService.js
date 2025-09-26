const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

async function uploadFile(fileBuffer, destinationPath, mimeType) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(destinationPath);
    const token = uuidv4();

    try {
        await file.save(fileBuffer, {
            metadata: {
                contentType: mimeType,
                metadata: {
                    firebaseStorageDownloadTokens: token
                }
            },
            public: true,
        });
        
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(destinationPath)}`;
        
        console.log(`Archivo subido exitosamente a Firebase Storage: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error('Error al subir archivo a Firebase Storage:', error);
        throw new Error('No se pudo subir el archivo a Firebase Storage.');
    }
}

// --- INICIO DE LA NUEVA FUNCIÓN ---
async function deleteFileByUrl(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.startsWith('https://storage.googleapis.com/')) {
        return; // No es una URL de Firebase Storage válida
    }

    try {
        const bucket = admin.storage().bucket();
        // Extraer la ruta del archivo desde la URL
        // Ejemplo URL: https://storage.googleapis.com/bucket-name/empresas%2F...%2Farchivo.jpg
        const decodedUrl = decodeURIComponent(fileUrl);
        const pathStartIndex = decodedUrl.indexOf(bucket.name) + bucket.name.length + 1;
        const filePath = decodedUrl.substring(pathStartIndex);

        await bucket.file(filePath).delete();
        console.log(`Archivo eliminado de Storage: ${filePath}`);
    } catch (error) {
        // Ignorar errores si el archivo ya no existe (código 404)
        if (error.code !== 404) {
            console.error(`Error al eliminar archivo de Storage (${fileUrl}):`, error.message);
        }
    }
}
// --- FIN DE LA NUEVA FUNCIÓN ---

module.exports = {
    uploadFile,
    deleteFileByUrl // <-- Exportar la nueva función
};