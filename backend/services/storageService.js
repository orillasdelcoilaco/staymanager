const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

async function uploadFile(fileBuffer, destinationPath, mimeType) {
    const bucket = admin.storage().bucket(); // Usa el bucket por defecto configurado en la inicialización
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
            public: true, // Esto es importante para generar URLs públicas
        });
        
        // La URL pública se construye manualmente
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(destinationPath)}`;
        
        console.log(`Archivo subido exitosamente a Firebase Storage: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error('Error al subir archivo a Firebase Storage:', error);
        throw new Error('No se pudo subir el archivo a Firebase Storage.');
    }
}

module.exports = {
    uploadFile,
};