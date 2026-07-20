import type { FastifyInstance } from "fastify";
import {
  upsertPushSubscription,
  deletePushSubscription,
  InvalidPushSubscriptionError,
  type PushSubscriptionInput,
} from "../db/pushSubscriptions";
import { sendToAllSubscriptions, REMINDER_PAYLOAD, type VapidConfig } from "../push/sendPush";

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

interface UnsubscribeBody {
  endpoint?: string;
}

function toSubscriptionInput(body: SubscribeBody): PushSubscriptionInput {
  return {
    endpoint: body.endpoint ?? "",
    p256dh: body.keys?.p256dh ?? "",
    auth: body.keys?.auth ?? "",
  };
}

export async function pushRoutes(app: FastifyInstance, vapid: VapidConfig): Promise<void> {
  // Authentifiziert wie alle /api/v1-Routen (s. app.ts PUBLIC_PATHS) - liefert
  // den öffentlichen VAPID-Key zur Laufzeit statt als Build-Time-Konstante
  // (VITE_-Env), damit eine Key-Rotation nur einen Server-Neustart statt
  // einen Frontend-Rebuild braucht (M5b-Review, Punkt 3).
  app.get("/api/v1/push/vapid-public-key", async (_request, reply) => {
    return reply.send({ publicKey: vapid.publicKey });
  });

  app.post<{ Body: SubscribeBody }>("/api/v1/push/subscribe", async (request, reply) => {
    try {
      const subscription = upsertPushSubscription(app.db, toSubscriptionInput(request.body ?? {}));
      return reply.send({ subscription });
    } catch (error) {
      if (error instanceof InvalidPushSubscriptionError) {
        return reply.code(400).send({ error: "invalid_subscription", message: error.message });
      }
      throw error;
    }
  });

  app.delete<{ Body: UnsubscribeBody }>("/api/v1/push/subscribe", async (request, reply) => {
    const endpoint = request.body?.endpoint;
    if (!endpoint) {
      return reply.code(400).send({ error: "endpoint fehlt" });
    }
    deletePushSubscription(app.db, endpoint);
    return reply.code(204).send();
  });

  // M5b-Review, Punkt 7: ohne diesen Endpoint lässt sich der komplette
  // Push-Pfad (Subscribe -> echter Push-Service -> SW-push-Event ->
  // OS-Notification) vor dem iPhone-Pflichttest (SPEC.md §11) nicht
  // end-to-end verifizieren - Warten auf 21:00 Uhr ist kein Test. Sofortiger
  // Testversand an alle registrierten Geräte, unabhängig von Fälligkeit.
  app.post("/api/v1/push/test-send", async (_request, reply) => {
    await sendToAllSubscriptions(app.db, REMINDER_PAYLOAD, vapid);
    return reply.send({ sent: true });
  });
}
