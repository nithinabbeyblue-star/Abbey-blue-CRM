import webpush from "web-push";
import { db } from "@/lib/db";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@abbeylegal.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
  });

  const staleIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        // Remove expired/invalid subscriptions (410 Gone or 404)
        if (
          err &&
          typeof err === "object" &&
          "statusCode" in err &&
          ((err as { statusCode: number }).statusCode === 410 ||
            (err as { statusCode: number }).statusCode === 404)
        ) {
          staleIds.push(sub.id);
        }
      }
    })
  );

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    await db.pushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}
