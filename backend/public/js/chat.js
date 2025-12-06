/**
 * SuiteManager Concierge Widget
 * Handles chat interaction with the backend AI.
 */

document.addEventListener('DOMContentLoaded', () => {
    const widget = document.getElementById('concierge-widget');
    if (!widget) return;

    const empresaId = widget.dataset.empresaId;
    const launchBtn = document.getElementById('concierge-launch-btn');
    const chatWindow = document.getElementById('concierge-window');
    const closeBtn = document.getElementById('concierge-close-btn');
    const sendBtn = document.getElementById('concierge-send-btn');
    const input = document.getElementById('concierge-input');
    const messagesContainer = document.getElementById('concierge-messages');

    // State
    let isOpen = false;

    // Toggle Chat
    function toggleChat() {
        isOpen = !isOpen;
        if (isOpen) {
            chatWindow.classList.remove('hidden');
            chatWindow.classList.add('flex');
            setTimeout(() => input.focus(), 100);
        } else {
            chatWindow.classList.add('hidden');
            chatWindow.classList.remove('flex');
        }
    }

    launchBtn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    // Send Message
    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // User Message UI
        appendMessage('user', text);
        input.value = '';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Loading State
        const loadingId = appendLoading();

        try {
            const response = await fetch('/api/concierge/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    empresaId: empresaId
                })
            });

            const data = await response.json();
            removeLoading(loadingId);

            if (data.error) {
                appendMessage('system', 'Lo siento, hubo un error de conexión.');
            } else {
                appendMessage('assistant', data.content);

                // Render Properties if any
                if (data.data && data.data.properties && data.data.properties.length > 0) {
                    appendProperties(data.data.properties);
                }
            }

        } catch (error) {
            console.error('Chat Error:', error);
            removeLoading(loadingId);
            appendMessage('system', 'Error de red. Intenta nuevamente.');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // UI Helpers
    function appendMessage(role, text) {
        const div = document.createElement('div');
        div.className = `p-3 rounded-lg mb-2 max-w-[85%] text-sm ${role === 'user'
                ? 'bg-blue-600 text-white self-end ml-auto'
                : 'bg-gray-100 text-gray-800 self-start'
            }`;
        div.innerText = text;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function appendLoading() {
        const id = 'loading-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'p-3 rounded-lg mb-2 bg-gray-100 text-gray-500 text-sm self-start flex gap-1 items-center';
        div.innerHTML = `
            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
        `;
        messagesContainer.appendChild(div);
        return id;
    }

    function removeLoading(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function appendProperties(properties) {
        const container = document.createElement('div');
        container.className = 'flex overflow-x-auto gap-2 mb-2 p-1 pb-2';

        properties.forEach(p => {
            const card = document.createElement('div');
            card.className = 'min-w-[200px] w-[200px] bg-white border border-gray-200 rounded-lg shadow-sm flex-shrink-0 cursor-pointer hover:shadow-md transition';
            card.onclick = () => window.location.href = `/propiedad/${p.id}`; // Simple navigation

            const imgUrl = p.foto || '/public/placeholder_prop.jpg'; // Quick fix for now

            card.innerHTML = `
                <div class="h-28 bg-gray-200 w-full rounded-t-lg bg-cover bg-center" style="background-image: url('${imgUrl}')"></div>
                <div class="p-2">
                    <h4 class="font-bold text-xs truncate">${p.nombre}</h4>
                    <p class="text-xs text-blue-600 font-semibold mt-1">Ver Detalles</p>
                </div>
            `;
            container.appendChild(card);
        });

        messagesContainer.appendChild(container);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});
