/** Bloque HTML: contexto comercial persistido (metadata.contextoComercial). */

export function renderSeccionContextoComercialModal() {
    return `
                        <!-- Contexto comercial (metadata.contextoComercial + IA / web) -->
                        <div class="bg-white p-6 rounded-lg shadow-sm border border-primary-100">
                            <h4 class="text-lg font-semibold text-primary-800 mb-1 border-b pb-2">Contexto comercial (web e IA)</h4>
                            <p class="text-sm text-gray-500 mb-4">Opcional. Si lo dejas vacío, el sistema infiere sugerencias desde nombre y descripciones.</p>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <span class="block text-sm font-medium text-gray-700 mb-2">Tipo de viaje ideal</span>
                                    <div class="flex flex-wrap gap-2 text-sm">
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-primary-50"><input type="checkbox" name="ctx-tv" value="familias" class="rounded text-primary-600"> Familias</label>
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-primary-50"><input type="checkbox" name="ctx-tv" value="parejas" class="rounded text-primary-600"> Parejas</label>
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-primary-50"><input type="checkbox" name="ctx-tv" value="grupos" class="rounded text-primary-600"> Grupos</label>
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-primary-50"><input type="checkbox" name="ctx-tv" value="negocios" class="rounded text-primary-600"> Negocios</label>
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-primary-50"><input type="checkbox" name="ctx-tv" value="solos" class="rounded text-primary-600"> Viajeros solos</label>
                                    </div>
                                </div>
                                <div>
                                    <span class="block text-sm font-medium text-gray-700 mb-2">Entorno</span>
                                    <div class="flex flex-wrap gap-2 text-sm">
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-success-50"><input type="checkbox" name="ctx-ent" value="bosque" class="rounded text-success-600"> Bosque</label>
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-success-50"><input type="checkbox" name="ctx-ent" value="rio" class="rounded text-success-600"> Río</label>
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-success-50"><input type="checkbox" name="ctx-ent" value="lago" class="rounded text-success-600"> Lago</label>
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-success-50"><input type="checkbox" name="ctx-ent" value="montaña" class="rounded text-success-600"> Montaña</label>
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-success-50"><input type="checkbox" name="ctx-ent" value="costa" class="rounded text-success-600"> Costa</label>
                                        <label class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-success-50"><input type="checkbox" name="ctx-ent" value="ciudad" class="rounded text-success-600"> Ciudad</label>
                                    </div>
                                </div>
                                <div class="md:col-span-2">
                                    <label for="ctx-destacados" class="block text-sm font-medium text-gray-700 mb-1">Destacados comerciales (uno por línea)</label>
                                    <textarea id="ctx-destacados" name="ctx-destacados" rows="3" class="form-input w-full text-sm" placeholder="Ej: Tinaja con vista al volcán (una idea por línea)"></textarea>
                                </div>
                            </div>
                        </div>
`;
}
