self.addEventListener("push", (event) => {
    const payload = event.data ? event.data.json() : {};
    const title = payload.title || "BagScan Alert";
    const options = {
        body: payload.body || "A new BagScan alert is ready.",
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: payload.tag || "bagscan-alert",
        data: {
            url: payload.url || "/alpha",
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/alpha";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ("focus" in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }

            return undefined;
        })
    );
});
