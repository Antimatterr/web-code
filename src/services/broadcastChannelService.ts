export type BroadcastMessage =
  | { type: "UPDATE_BUNDLE"; bundle: string }
  | { type: "PREVIEW_READY" }
  | { type: "REQUEST_BUNDLE" };

type MessageHandler = (msg: BroadcastMessage) => void;

class BroadcastService {
  private channel: BroadcastChannel;
  private handlers = new Set<MessageHandler>();
  private lastBundle: string = "";

  constructor() {
    this.channel = new BroadcastChannel("code-preview-channel");
    this.channel.onmessage = (e: MessageEvent<BroadcastMessage>) => {
      const msg = e.data;

      if (msg.type === "REQUEST_BUNDLE" && this.lastBundle) {
        return;
      }

      this.handlers.forEach((h) => h(msg));
    };
  }

  sendBundle(bundle: string) {
    this.lastBundle = bundle;
    this.channel.postMessage({
      type: "UPDATE_BUNDLE",
      bundle,
    } satisfies BroadcastMessage);
  }

  sendReady() {
    this.channel.postMessage({
      type: "PREVIEW_READY",
    } satisfies BroadcastMessage);
  }

  requestBundle() {
    this.channel.postMessage({
      type: "REQUEST_BUNDLE",
    } satisfies BroadcastMessage);
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler);
    // Return cleanup function
    return () => this.handlers.delete(handler);
  }

  destroy() {
    this.handlers.clear();
    this.channel.close();
  }
}
export const broadcastService = new BroadcastService();
