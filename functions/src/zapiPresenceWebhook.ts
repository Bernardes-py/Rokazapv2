import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Webhook para receber eventos de presença do chat (on-chat-presence).
 *
 * Payload esperado da Z-API:
 * {
 *   "type": "PresenceChatCallback",
 *   "phone": "5544999999999",
 *   "status": "COMPOSING" | "RECORDING" | "AVAILABLE" | "UNAVAILABLE" | "PAUSED",
 *   "lastSeen": timestamp | null,
 *   "instanceId": "instance.id"
 * }
 *
 * Armazena em: presence/{phone}
 */
export const zapiPresenceWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    console.log("[Presence] Payload completo recebido:", JSON.stringify(req.body));
    const { phone, status, lastSeen } = req.body;

    if (!phone || !status) {
      console.warn("Presence webhook: payload inválido", JSON.stringify(req.body));
      res.status(400).send("phone and status required");
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    console.log(`[Presence] ${normalizedPhone} -> ${status}`);

    await db.collection("presence").doc(normalizedPhone).set(
      {
        phone: normalizedPhone,
        status: status.toUpperCase(),
        lastSeen: lastSeen ? new Date(lastSeen * 1000) : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).send("OK");
  } catch (error) {
    console.error("Erro no presence webhook:", error);
    res.status(500).send("Internal Error");
  }
});
