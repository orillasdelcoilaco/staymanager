const { generarPropuestaDeEspacio } = require('../services/logicaEspacios');

describe('generarPropuestaDeEspacio', () => {
    test('Dormitorio con Cama King: Validación de Estructura y SEO', () => {
        const input = {
            tipoEspacio: 'Dormitorio',
            activosSeleccionados: ['Cama King', 'TV 50"', 'Vista al mar'],
            detallesAdicionales: 'Decoración moderna y luminosa'
        };

        const resultado = generarPropuestaDeEspacio(input.tipoEspacio, input.activosSeleccionados, input.detallesAdicionales);

        expect(resultado).toBeDefined();
        expect(resultado.seo.title).toContain('Dormitorio');
        expect(resultado.ssr.descripcionCorta).toBeDefined();

        // AI Native Change: No requirements calculated locally anymore
        expect(resultado.requerimientosFotos).toEqual([]);
        expect(resultado.promptFotos).toBeDefined();
        expect(resultado.promptFotos).toContain('Director de Arte');
    });

    test('H1 Robustez: Detalles largos deben usar activo principal', () => {
        const input = {
            tipoEspacio: 'Dormitorio',
            activosSeleccionados: ['Cama King'],
            detallesAdicionales: 'Este es un detalle muy largo que debería ser ignorado en el H1 por ser demasiado extenso'
        };
        const resultado = generarPropuestaDeEspacio(input.tipoEspacio, input.activosSeleccionados, input.detallesAdicionales);

        // "Este" -> "Cama King"
        expect(resultado.seo.h1).toBe('Dormitorio - Cama King');
    });

    test('AI-Native: Genera prompt de evaluación y devuelve array vacío', () => {
        const input = {
            tipoEspacio: 'Dormitorio',
            activosSeleccionados: ['Cama Matrimonial', 'Baño en suite', 'TV 55"', 'Vaso de agua'],
        };
        const resultado = generarPropuestaDeEspacio(input.tipoEspacio, input.activosSeleccionados);

        // Verificamos cambio de paradigma: Array vacío, Prompt presente
        expect(resultado.requerimientosFotos).toEqual([]);
        expect(resultado.promptFotos).toBeDefined();

        const prompt = resultado.promptFotos;
        expect(prompt).toContain('Director de Arte');
        expect(prompt).toContain('Criterios de eliminación');
        expect(prompt).toContain('Vaso de agua');
    });
});
