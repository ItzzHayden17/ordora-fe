
self.addEventListener("push", (event) => {
    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = {
            title: "Tablewise",
            body: event.data
                ? event.data.text()
                : "You have a new update.",
        };
    }

    const title = data.title || "Tablewise";

    const options = {
        body: data.body || "You have a new update.",
        icon: "/logo192.png",
        badge: "/logo192.png",
        tag: data.tag || "tablewise-update",

        // Request vibration on supported devices.
        vibrate: data.vibrate || [200, 100, 200, 100, 300],

        // Keep the notification visible until interaction where supported.
        requireInteraction: data.requireInteraction ?? true,

        data: {
            url: data.url || "/waiter",
        },
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = new URL(
        event.notification.data?.url || "/waiter",
        self.location.origin
    ).href;

    event.waitUntil(
        self.clients
            .matchAll({
                type: "window",
                includeUncontrolled: true,
            })
            .then((clients) => {
                for (const client of clients) {
                    if (
                        client.url.startsWith(self.location.origin) &&
                        "focus" in client
                    ) {
                        if ("navigate" in client) {
                            client.navigate(targetUrl);
                        }

                        return client.focus();
                    }
                }

                return self.clients.openWindow(targetUrl);
            })
    );
});
