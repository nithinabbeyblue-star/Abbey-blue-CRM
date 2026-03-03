import Pusher from "pusher";

let pusherInstance: Pusher | null = null;

export function getPusher(): Pusher | null {
  if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY || !process.env.PUSHER_SECRET) {
    return null;
  }

  if (!pusherInstance) {
    pusherInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER || "eu",
      useTLS: true,
    });
  }

  return pusherInstance;
}

/**
 * Trigger a Pusher event. Fails silently if Pusher is not configured.
 */
export async function triggerEvent(
  channel: string,
  event: string,
  data: unknown
): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(channel, event, data);
  } catch (err) {
    console.error("Pusher trigger error:", err);
  }
}

/** Channel names */
export function caseChannel(ticketId: string): string {
  return `private-case-${ticketId}`;
}

export function userChannel(userId: string): string {
  return `private-user-${userId}`;
}
