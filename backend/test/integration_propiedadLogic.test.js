const { generarPlanFotos, hydrateInventory } = require('../services/propiedadLogicService');

describe('Integration: PropiedadLogicService -> LogicaEspacios', () => {
    test('generarPlanFotos debe delegar a logicaEspacios y retornar formato legacy', () => {
        const componentes = [
            {
                id: 'comp-1',
                tipo: 'Dormitorio',
                nombre: 'Suite Principal', // Detalles
                elementos: [
                    { nombre: 'Cama King', quantity: 1 },
                    { nombre: 'Vista al Mar', quantity: 1 }
                ]
            }
        ];

        const plan = generarPlanFotos(componentes);

        expect(plan).toBeDefined();
        expect(plan['comp-1']).toBeDefined();

        // Verificar mapeo legacy (Ahora vacío porque es AI Native)
        // El frontend recibirá un array vacío hasta que se implemente la llamada real a la IA
        expect(plan['comp-1'].length).toBe(0);
    });

    test('hydrateInventory debe respetar capacity si viene en el input', () => {
        const componentes = [
            {
                elementos: [
                    { nombre: 'Cama Custom Space', cantidad: 1, capacity: 3 } // Input explicito
                ]
            }
        ];

        const { inventory } = hydrateInventory(componentes);
        const elemento = inventory[0].elementos[0];

        expect(elemento.capacidad_total).toBe(3); // 1 * 3
        expect(elemento.ssr_status).toBe('verified');
        expect(elemento._match_method).toBe('database');
    });

    test('hydrateInventory debe asignar 0 si no hay capacity', () => {
        const componentes = [
            {
                elementos: [
                    { nombre: 'Mesa', cantidad: 1 } // Sin capacity
                ]
            }
        ];

        const { inventory } = hydrateInventory(componentes);
        const elemento = inventory[0].elementos[0];

        expect(elemento.capacidad_total).toBe(0);
        expect(elemento.capacity).toBe(0);
    });
});
