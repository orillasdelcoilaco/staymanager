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
            3. Usa la Action 'buscar_disponibilidad' con el empresaId predefinido.
            4. Sé amable y usa el tono de la marca.
        `,
        actions: [
            {
                name: "buscar_mir_disponibilidad",
                description: "Verifica disponibilidad en mis alojamientos.",
                method: "POST",
                path: "/api/concierge/availability",
                parameters: {
                    type: "object",
                    properties: {
                        // EmpresaID is hidden/injected or fixed in the API context for private GPTs, 
                        // but here we make it explicit for the Action definition schema.
                        empresaId: { type: "string", const: empresa.id, description: "ID Fijo de esta empresa" },
                        personas: { type: "integer" },
                        fechas: {
                            type: "object",
                            properties: {
                                entrada: { type: "string" },
                                salida: { type: "string" }
                            }
                        }
                    },
                    required: ["personas", "empresaId"]
                }
            },
            {
                name: "ver_mis_fotos",
                description: "Muestra fotos de mis unidades.",
                method: "GET",
                path: "/api/concierge/more-photos",
                parameters: {
                    type: "object",
                    properties: {
                        alojamientoId: { type: "string" },
                        empresaId: { type: "string", const: empresa.id }
                    },
                    required: ["alojamientoId", "empresaId"]
                }
            }
        ]
    };
};

module.exports = { generateEnterpriseManifest };
