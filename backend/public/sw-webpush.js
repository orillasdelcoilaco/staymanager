/* Service worker mínimo — notificaciones push del resumen diario (§1.4). */
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (_) {
        data = { title: 'SuiteManager', body: event.data ? event.data.text() : '' };
    }
    const title = data.title || 'SuiteManager';
    const body = data.body || 'Tienes un aviso de operación.';
    const openUrl = data.url || '/';
    event.waitUntil(self.registration.showNotification(title, {
        body,
        data: { url: openUrl },
        icon: '/public/favicon.ico',
        badge: '/public/favicon.ico',
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const c of clientList) {
                if (c.url && 'focus' in c) return c.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(url);
        })
    );
});
