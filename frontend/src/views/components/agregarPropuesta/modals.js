export function initPropuestaGuardadaModal() {
  const modalHTML = `
    <div id="propuesta-guardada-modal" class="modal hidden">
      <div class="modal-content !max-w-2xl">
        <h3 class="text-xl font-semibold mb-4">Propuesta Guardada con Éxito</h3>
        <p class="text-sm text-gray-600 mb-4">Copia el siguiente resumen y envíalo al cliente. Puedes gestionar esta y otras propuestas en la nueva sección "Gestionar Propuestas".</p>
        <textarea id="propuesta-texto" rows="15" class="form-input w-full bg-gray-50 font-mono text-xs"></textarea>
        <div class="flex justify-end space-x-2 mt-4">
          <button id="copiar-propuesta-btn" class="btn-secondary">Copiar</button>
          <button id="cerrar-propuesta-modal-btn" class="btn-primary">Cerrar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}