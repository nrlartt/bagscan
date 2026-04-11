import "server-only";

interface WebPushSubscriptionPayload {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
        p256dh: string;
        auth: string;
    };
}

interface WebPushSendError {
    statusCode?: number;
}

interface WebPushApi {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
        subscription: WebPushSubscriptionPayload,
        payload?: string
    ): Promise<unknown>;
}

let cachedClient: WebPushApi | null = null;

function loadWebPush(): WebPushApi {
    if (cachedClient) {
        return cachedClient;
    }

    const dynamicRequire = eval("require") as NodeJS.Require;
    const loaded = dynamicRequire("web-push") as WebPushApi | { default?: WebPushApi };
    cachedClient =
        "default" in loaded && loaded.default
            ? loaded.default
            : (loaded as WebPushApi);
    return cachedClient;
}

export function getConfiguredWebPush(pushConfig: {
    subject: string;
    publicKey: string;
    privateKey: string;
}) {
    const webpush = loadWebPush();
    webpush.setVapidDetails(
        pushConfig.subject,
        pushConfig.publicKey,
        pushConfig.privateKey
    );
    return webpush;
}

export type { WebPushSendError, WebPushSubscriptionPayload };
