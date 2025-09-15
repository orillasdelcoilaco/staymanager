import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { register as registerAPI } from '../api.js';
import { handleNavigation } from '../router.js';

export function renderLogin(container) {
    container.innerHTML = `
        <div class="flex items-center justify-center min-h-screen bg-gray-100">
            <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <div>
                    <h2 id="form-title" class="text-2xl font-bold text-center text-gray-900">Iniciar Sesión</h2>
                    <p class="mt-2 text-sm text-center text-gray-600">
                        O <a href="#" id="toggle-form" class="font-medium text-indigo-600 hover:text-indigo-500">crea una cuenta para tu empresa</a>
                    </p>
                </div>

                <form id="auth-form" class="space-y-6">
                    <div id="empresa-container" class="hidden">
                        <label for="empresa" class="block text-sm font-medium text-gray-700">Nombre de la Empresa</label>
                        <input id="empresa" name="empresa" type="text" autocomplete="organization" class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    </div>
                    <div>
                        <label for="email" class="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                        <input id="email" name="email" type="email" autocomplete="email" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    </div>
                    <div>
                        <label for="password" class="block text-sm font-medium text-gray-700">Contraseña</label>
                        <input id="password" name="password" type="password" autocomplete="current-password" required class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    </div>
                    <div>
                        <button type="submit" id="submit-btn" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            Iniciar Sesión
                        </button>
                    </div>
                </form>
                <p id="auth-error" class="text-sm text-center text-red-600"></p>
            </div>
        </div>
    `;

    // Lógica para alternar entre login y registro
    const toggleLink = document.getElementById('toggle-form');
    const formTitle = document.getElementById('form-title');
    const empresaContainer = document.getElementById('empresa-container');
    const submitBtn = document.getElementById('submit-btn');
    let isLogin = true;

    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        formTitle.textContent = isLogin ? 'Iniciar Sesión' : 'Crear Nueva Cuenta';
        empresaContainer.classList.toggle('hidden', isLogin);
        submitBtn.textContent = isLogin ? 'Iniciar Sesión' : 'Registrar Empresa';
        toggleLink.innerHTML = isLogin ? 'crea una cuenta para tu empresa' : 'ya tienes una cuenta? Inicia sesión';
        document.getElementById('auth-error').textContent = '';
    });

    // Lógica para manejar el envío del formulario
    const authForm = document.getElementById('auth-form');
    const authError = document.getElementById('auth-error');

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando...';
        authError.textContent = '';

        const email = authForm.email.value;
        const password = authForm.password.value;
        const auth = getAuth(window.firebaseApp);

        try {
            if (isLogin) {
                // --- Lógica de Inicio de Sesión ---
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const idToken = await userCredential.user.getIdToken();
                localStorage.setItem('idToken', idToken);
                handleNavigation('/'); // Redirige al dashboard
            } else {
                // --- Lógica de Registro ---
                const nombreEmpresa = authForm.empresa.value;
                if (!nombreEmpresa) {
                    throw new Error('El nombre de la empresa es obligatorio.');
                }
                // Llama a nuestra API para registrar la empresa y el usuario en Firestore
                const result = await registerAPI({ nombreEmpresa, email, password });
                
                // Luego, inicia sesión con el usuario recién creado para obtener su token
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const idToken = await userCredential.user.getIdToken();
                localStorage.setItem('idToken', idToken);
                alert(`¡Empresa "${result.nombreEmpresa}" registrada con éxito!`);
                handleNavigation('/'); // Redirige al dashboard
            }
        } catch (error) {
            console.error("Error de autenticación:", error);
            authError.textContent = error.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isLogin ? 'Iniciar Sesión' : 'Registrar Empresa';
        }
    });
}

