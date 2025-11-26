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
        
        // Generar URL pública basada en el token
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
 * Esta es la función que faltaba y corrige el error "deleteFileByPath is not a function".
 */
async function deleteFileByPath(pathOrUrl) {
    if (!pathOrUrl) return;

    try {
        const bucket = admin.storage().bucket();
        let relativePath = pathOrUrl;
        
        // Si recibimos una URL completa (http...), extraemos la ruta interna
        if (pathOrUrl.startsWith('http')) {
            if (pathOrUrl.includes('/o/')) {
                // Formato: .../o/carpeta%2Fimagen.jpg?alt=...
                // Cortamos después de '/o/' y quitamos los parámetros (?)
                const pathPart = pathOrUrl.split('/o/')[1].split('?')[0];
                relativePath = decodeURIComponent(pathPart);
            } else {
                // Intento genérico de limpieza si no tiene el formato estándar
                const urlObj = new URL(pathOrUrl);
                relativePath = decodeURIComponent(urlObj.pathname.substring(1)); // Quitar el primer slash
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
        // Solo logueamos el error, no rompemos la ejecución del programa
        console.error(`[Storage Error] Fallo al eliminar ${pathOrUrl}:`, error.message);
    }
}

/**
 * Mantenemos esta función por compatibilidad, pero ahora usa la lógica robusta.
 */
async function deleteFileByUrl(fileUrl) {
    return deleteFileByPath(fileUrl);
}

/**
 * Renombra un archivo (Mover = Copiar + Borrar)
 */
async function renameFileByUrl(oldUrl, newId) {
    if (!oldUrl || typeof oldUrl !== 'string' || !newId) {
        return oldUrl;
    }

    try {
        const bucket = admin.storage().bucket();
        let oldFilePath;

        // 1. Obtener el path antiguo desde la URL
        if (oldUrl.includes('/o/')) {
             const pathPart = oldUrl.split('/o/')[1].split('?')[0];
             oldFilePath = decodeURIComponent(pathPart);
        } else if (oldUrl.startsWith('https://storage.googleapis.com/')) {
             const pathStartIndex = oldUrl.indexOf(bucket.name) + bucket.name.length + 1;
             oldFilePath = decodeURIComponent(oldUrl.substring(pathStartIndex));
        } else {
            return oldUrl; // URL no reconocida, devolvemos la original
        }

        // 2. Calcular el nuevo path
        const pathParts = oldFilePath.split('/');
        const oldFileName = pathParts[pathParts.length - 1];
        
        // Suponemos que el ID es la parte antes del primer guion bajo o guion
        // (Ajusta esto si tu lógica de nombres es diferente)
        const oldId = oldFileName.split(/[-_]/)[0]; 
        
        if (oldId === newId) {
            return oldUrl; // Ya tiene el ID correcto
        }

        const newFileName = oldFileName.replace(oldId, newId);
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join('/');

        const oldFile = bucket.file(oldFilePath);
        
        // 3. Verificar y Mover
        const [exists] = await oldFile.exists();
        if (!exists) {
             console.warn(`[Storage] Archivo origen no existe para renombrar: ${oldFilePath}`);
             return oldUrl;
        }

        await oldFile.move(newFilePath);

        // 4. Generar nueva URL pública
        const token = uuidv4();
        await bucket.file(newFilePath).setMetadata({
             metadata: { firebaseStorageDownloadTokens: token }
        });
        
        const newPublicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newFilePath)}?alt=media&token=${token}`;
        
        console.log(`[Storage] Renombrado: ${oldFilePath} -> ${newFilePath}`);
        return newPublicUrl;

    } catch (error) {
        console.error(`[Storage Error] Fallo al renombrar ${oldUrl}:`, error.message);
        return oldUrl; // En caso de error, devolvemos la URL original para no romper datos
    }
}

module.exports = {
    uploadFile,
    deleteFileByPath, // <--- Exportación clave agregada
    deleteFileByUrl,
    renameFileByUrl
};