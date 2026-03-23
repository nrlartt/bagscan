declare module "web-push" {
    interface PushSubscription {
        endpoint: string;
        expirationTime?: number | null;
        keys: {
            p256dh: string;
            auth: string;
        };
    }

    interface SendResult {
        statusCode?: number;
        body?: string;
        headers?: Record<string, string>;
    }

    interface WebPushApi {
        setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
        sendNotification(subscription: PushSubscription, payload?: string): Promise<SendResult>;
    }

    const webpush: WebPushApi;
    export default webpush;
}
