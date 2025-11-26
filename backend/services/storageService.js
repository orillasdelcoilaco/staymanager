// backend/services/storageService.js
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

/**
 * Sube un archivo al Storage y retorna una URL pública firmada
 */
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
            }
        });
        
        // Generar URL pública
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destinationPath)}?alt=media&token=${token}`;
        
        console.log(`[Storage] Archivo subido: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error('[Storage] Error al subir archivo:', error);
        throw new Error('No se pudo subir el archivo a Firebase Storage.');
    }
}

/**
 * Elimina un archivo recibiendo su Path relativo o su URL completa.
 * (Esta es la función que faltaba)
 */
async function deleteFileByPath(pathOrUrl) {
    if (!pathOrUrl) return;

    try {
        const bucket = admin.storage().bucket();
        let relativePath = pathOrUrl;
        
        // Si recibimos una URL completa, extraemos la ruta interna
        if (pathOrUrl.startsWith('http')) {
            if (pathOrUrl.includes('/o/')) {
                const pathPart = pathOrUrl.split('/o/')[1].split('?')[0];
                relativePath = decodeURIComponent(pathPart);
            } else {
                const urlObj = new URL(pathOrUrl);
                relativePath = decodeURIComponent(urlObj.pathname.substring(1));
            }
        }

        const file = bucket.file(relativePath);
        const [exists] = await file.exists();
        
        if (exists) {
            await file.delete();
            console.log(`[Storage] Archivo eliminado: ${relativePath}`);
        } else {
            console.warn(`[Storage] No se pudo eliminar (no existe): ${relativePath}`);
        }
    } catch (error) {
        console.error(`[Storage Error] Fallo al eliminar ${pathOrUrl}:`, error.message);
    }
}

async function deleteFileByUrl(fileUrl) {
    return deleteFileByPath(fileUrl);
}

async function renameFileByUrl(oldUrl, newId) {
    if (!oldUrl || typeof oldUrl !== 'string' || !newId) return oldUrl;

    try {
        const bucket = admin.storage().bucket();
        let oldFilePath;

        if (oldUrl.includes('/o/')) {
             const pathPart = oldUrl.split('/o/')[1].split('?')[0];
             oldFilePath = decodeURIComponent(pathPart);
        } else if (oldUrl.startsWith('https://storage.googleapis.com/')) {
             const pathStartIndex = oldUrl.indexOf(bucket.name) + bucket.name.length + 1;
             oldFilePath = decodeURIComponent(oldUrl.substring(pathStartIndex));
        } else {
            return oldUrl;
        }

        const pathParts = oldFilePath.split('/');
        const oldFileName = pathParts[pathParts.length - 1];
        const oldId = oldFileName.split(/[-_]/)[0]; 
        
        if (oldId === newId) return oldUrl;

        const newFileName = oldFileName.replace(oldId, newId);
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join('/');

        const oldFile = bucket.file(oldFilePath);
        const [exists] = await oldFile.exists();
        if (!exists) return oldUrl;

        await oldFile.move(newFilePath);

        const token = uuidv4();
        await bucket.file(newFilePath).setMetadata({
             metadata: { firebaseStorageDownloadTokens: token }
        });
        
        const newPublicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newFilePath)}?alt=media&token=${token}`;
        return newPublicUrl;

    } catch (error) {
        console.error(`[Storage Error] Fallo al renombrar:`, error.message);
        return oldUrl;
    }
}

module.exports = {
    uploadFile,
    deleteFileByPath, // <--- ¡Esta exportación es la clave!
    deleteFileByUrl,
    renameFileByUrl
};