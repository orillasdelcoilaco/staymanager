export function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow max-w-2xl mx-auto">
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">Autorizar Conexión con Google Contacts</h2>
            <p class="text-gray-600 mt-4">
                Para que StayManager pueda crear y sincronizar contactos automáticamente en tu cuenta de Google, debes conceder permiso una única vez.
            </p>
            <p class="text-gray-600 mt-2">
                Al hacer clic en el botón, serás redirigido a la pantalla de autorización de Google. Una vez que aceptes, la conexión quedará establecida.
            </p>
            <div class="mt-6">
                <a href="/api/auth/google/authorize" class="btn-primary inline-flex items-center">
                    <svg class="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48px" height="48px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.06-4.844C14.64,5.844,18.96,4,24,4c5.268,0,10.046,2.053,13.575,6.204l-5.657,5.657C30.046,13.12,27.189,12,24,12c-3.059,0-5.842,1.154-7.961,3.039L9.982,9.842C12.352,7.51,15.703,6,19.64,5.433L6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.519-3.536-11.088-8.261l-6.42,5.204C9.254,39.522,15.97,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,36.218,44,30.668,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
                    Autorizar con Google
                </a>
            </div>
             <p class="text-gray-500 text-sm mt-4">
                Después de autorizar, Google te redirigirá a una página con un mensaje de éxito. Luego de eso, ya podrás cerrar esa ventana.
            </p>
        </div>
    `;
}

export function afterRender() {
    // No se necesita JS adicional para esta vista
}