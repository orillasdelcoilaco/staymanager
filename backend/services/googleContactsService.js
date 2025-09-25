const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

let credentials;
try {
    credentials = process.env.RENDER
        ? require('/etc/secrets/google_credentials.json')
        : require('../google_credentials.json');
} catch (error) {
    console.error("CRITICAL: No se pudieron cargar las credenciales de Google. La autenticación de Google no funcionará.", error);
}

async function getAuthenticatedClient(db, empresaId) {
    if (!credentials) throw new Error('Las credenciales de Google no están configuradas en el servidor.');
    
    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    const empresaRef = db.collection('empresas').doc(empresaId);
    const doc = await empresaRef.get();

    if (!doc.exists || !doc.data().googleRefreshToken) {
        throw new Error('La empresa no ha autorizado la conexión con Google Contacts.');
    }
    
    oauth2Client.setCredentials({
        refresh_token: doc.data().googleRefreshToken
    });

    return oauth2Client;
}

async function findContactByName(authClient, nameQuery) {
    if (!nameQuery) return null;
    const people = google.people({ version: 'v1', auth: authClient });

    try {
        const res = await people.people.searchContacts({
            query: nameQuery,
            readMask: 'names,phoneNumbers,emailAddresses,metadata',
            pageSize: 5
        });

        if (res.data.results && res.data.results.length > 0) {
            return res.data.results.find(result =>
                result.person.names && result.person.names.some(n => n.displayName.toLowerCase() === nameQuery.toLowerCase())
            )?.person || null;
        }
        return null;
    } catch (error) {
        console.error(`Error buscando contacto en Google con la consulta "${nameQuery}":`, error.message);
        return null;
    }
}


async function createGoogleContact(db, empresaId, contactData) {
    try {
        const auth = await getAuthenticatedClient(db, empresaId);
        const contactName = `${contactData.nombre} ${contactData.canalNombre} ${contactData.idReservaCanal}`;

        const existingContact = await findContactByName(auth, contactName);
        if (existingContact) {
            console.log(`[Google Contacts] El contacto '${contactName}' ya existe. No se creará duplicado.`);
            return { status: 'exists' };
        }

        const people = google.people({ version: 'v1', auth });
        const resource = {
            names: [{ givenName: contactName }],
            phoneNumbers: [{ value: contactData.telefono }],
            emailAddresses: contactData.email ? [{ value: contactData.email }] : []
        };
        
        await people.people.createContact({ resource });
        console.log(`[Google Contacts] Contacto '${contactName}' creado exitosamente.`);
        return { status: 'created' };
    } catch (err) {
        console.error(`[Google Contacts] Error al crear contacto para la empresa ${empresaId}:`, err.message);
        return { status: 'error', message: err.message };
    }
}

async function updateGoogleContact(db, empresaId, oldContactName, newContactData) {
    try {
        const auth = await getAuthenticatedClient(db, empresaId);
        const people = google.people({ version: 'v1', auth });
        
        const existingContact = await findContactByName(auth, oldContactName);
        
        const newContactName = `${newContactData.nombre} ${newContactData.canalNombre} ${newContactData.idReservaCanal}`;

        if (existingContact) {
            const updatePayload = {
                etag: existingContact.etag,
                names: [{ givenName: newContactName }],
                phoneNumbers: [{ value: newContactData.telefono }],
                emailAddresses: newContactData.email ? [{ value: newContactData.email }] : []
            };
            
            await people.people.updateContact({
                resourceName: existingContact.resourceName,
                updatePersonFields: 'names,phoneNumbers,emailAddresses',
                requestBody: updatePayload,
            });
            console.log(`[Google Contacts] Contacto '${oldContactName}' actualizado a '${newContactName}'.`);
            return { status: 'updated' };
        } else {
             console.log(`[Google Contacts] No se encontró el contacto '${oldContactName}' para actualizar. Se creará uno nuevo.`);
             return await createGoogleContact(db, empresaId, newContactData);
        }
    } catch (err) {
        console.error(`[Google Contacts] Error al actualizar contacto para la empresa ${empresaId}:`, err.message);
        return { status: 'error', message: err.message };
    }
}

module.exports = {
    getAuthenticatedClient,
    findContactByName,
    createGoogleContact,
    updateGoogleContact
};