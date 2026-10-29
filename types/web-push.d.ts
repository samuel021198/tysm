declare module "web-push" {
  type PushClient = {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload?: string,
    ): Promise<unknown>;
  };
  const webpush: PushClient;
  export default webpush;
}
