// backend/services/storageService.js

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

async function deleteFileByUrl(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string' || !fileUrl.startsWith('https://storage.googleapis.com/')) {
        return; 
    }

    try {
        const bucket = admin.storage().bucket();
        const decodedUrl = decodeURIComponent(fileUrl);
        const pathStartIndex = decodedUrl.indexOf(bucket.name) + bucket.name.length + 1;
        const filePath = decodedUrl.substring(pathStartIndex);

        await bucket.file(filePath).delete();
        console.log(`Archivo eliminado de Storage: ${filePath}`);
    } catch (error) {
        if (error.code !== 404) {
            console.error(`Error al eliminar archivo de Storage (${fileUrl}):`, error.message);
        }
    }
}

async function renameFileByUrl(oldUrl, newId) {
    if (!oldUrl || typeof oldUrl !== 'string' || !oldUrl.startsWith('https://storage.googleapis.com/') || !newId) {
        return oldUrl; // Devuelve la URL original si no es válida o no hay nuevo ID
    }

    try {
        const bucket = admin.storage().bucket();
        const decodedUrl = decodeURIComponent(oldUrl);
        const pathStartIndex = decodedUrl.indexOf(bucket.name) + bucket.name.length + 1;
        const oldFilePath = decodedUrl.substring(pathStartIndex);
        
        const pathParts = oldFilePath.split('/');
        const oldFileName = pathParts[pathParts.length - 1];
        const oldId = oldFileName.split('_')[0];
        
        if (oldId === newId) {
            return oldUrl; // No hay necesidad de renombrar
        }

        const newFileName = oldFileName.replace(oldId, newId);
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join('/');

        const oldFile = bucket.file(oldFilePath);
        await oldFile.move(newFilePath);

        const newPublicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(newFilePath)}`;
        console.log(`Archivo renombrado de ${oldFilePath} a ${newFilePath}`);
        return newPublicUrl;
    } catch (error) {
        if (error.code === 404) {
            console.warn(`[renameFile] El archivo ${oldUrl} no fue encontrado, no se pudo renombrar.`);
            return oldUrl; // Devuelve la URL antigua si el archivo no existe
        }
        console.error(`Error al renombrar archivo de Storage (${oldUrl}):`, error.message);
        throw new Error('No se pudo renombrar el archivo en Firebase Storage.');
    }
}


module.exports = {
    uploadFile,
    deleteFileByUrl,
    renameFileByUrl
};