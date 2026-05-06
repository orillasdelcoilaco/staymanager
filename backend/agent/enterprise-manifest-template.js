/**
 * @fileoverview GPT Private Manifest Template
 * Logic to generate a specific Agent Manifest for a single Company (Tenant).
 */

const generateEnterpriseManifest = (empresa) => {
    return {
        name: `Asistente ${empresa.nombre}`,
        description: `Asistente virtual oficial de ${empresa.nombre}.`,
        instructions: `
            Eres el Asistente Virtual exclusivo de "${empresa.nombre}".
            Tu único objetivo es ayudar a los clientes a reservar en ESTA propiedad.
            
            INFORMACIÓN EMPRESA:
            - Nombre: ${empresa.nombre}
            - ID: ${empresa.id}
            - Slogan: ${empresa.slogan || ''}

            REGLAS:
            1. Solo respondes sobre disponibilidad de "${empresa.nombre}".
            2. Si preguntan por otros lugares, di que solo trabajas aquí.
            3. Usa la API pública documentada (OpenAPI) con el empresaId fijo; p. ej. GET /api/disponibilidad.
            4. Sé amable y usa el tono de la marca.
        `,
        actions: [
            {
                name: "buscar_mir_disponibilidad",
                description: "Verifica disponibilidad en mis alojamientos (misma ruta que OpenAPI ChatGPT /api/disponibilidad).",
                method: "GET",
                path: "/api/disponibilidad",
                parameters: {
                    type: "object",
                    properties: {
                        empresa_id: { type: "string", const: empresa.id, description: "ID fijo de esta empresa" },
                        checkin: { type: "string", description: "YYYY-MM-DD" },
                        checkout: { type: "string", description: "YYYY-MM-DD (exclusivo)" },
                        adultos: { type: "integer" }
                    },
                    required: ["empresa_id", "checkin", "checkout"]
                }
            },
            {
                name: "ver_mis_fotos",
                description: "Galería de fotos de un alojamiento (misma ruta que OpenAPI /api/alojamientos/imagenes).",
                method: "GET",
                path: "/api/alojamientos/imagenes",
                parameters: {
                    type: "object",
                    properties: {
                        alojamiento_id: { type: "string" },
                        empresa_id: { type: "string", const: empresa.id }
                    },
                    required: ["alojamiento_id", "empresa_id"]
                }
            }
        ]
    };
};

module.exports = { generateEnterpriseManifest };
