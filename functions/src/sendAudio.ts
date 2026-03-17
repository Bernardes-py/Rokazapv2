import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getZApiConfig } from "./zapiConfig";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

async function convertWebmToOgg(base64Data: string): Promise<string> {
  // Extract raw base64 (remove data URI prefix if present)
  const base64Match = base64Data.match(/^data:audio\/[^;]+(?:;[^;]+)*;base64,(.+)$/);
  const rawBase64 = base64Match ? base64Match[1] : base64Data;

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input_${Date.now()}.webm`);
  const outputPath = path.join(tmpDir, `output_${Date.now()}.ogg`);

  try {
    // Write input file
    fs.writeFileSync(inputPath, Buffer.from(rawBase64, "base64"));
    console.log("sendAudio - Convertendo WebM para OGG/Opus via ffmpeg...");

    // Convert using ffmpeg
    await execFileAsync("ffmpeg", [
      "-i", inputPath,
      "-c:a", "libopus",
      "-b:a", "64k",
      "-y",
      outputPath,
    ]);

    // Read converted file
    const outputBuffer = fs.readFileSync(outputPath);
    const outputBase64 = `data:audio/ogg;base64,${outputBuffer.toString("base64")}`;
    console.log("sendAudio - Conversão concluída. Tamanho output:", outputBase64.length);
    return outputBase64;
  } finally {
    // Cleanup
    try { fs.unlinkSync(inputPath); } catch (_) {}
    try { fs.unlinkSync(outputPath); } catch (_) {}
  }
}

function needsConversion(audio: string): boolean {
  return audio.startsWith("data:audio/webm");
}

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const sendAudio = functions.runWith({ timeoutSeconds: 120, memory: "512MB" }).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { phone, audio, conversationId, messageDocId } = data;

  console.log("sendAudio - Payload recebido:", JSON.stringify({ phone, audioLength: audio?.length, conversationId, messageDocId }));

  if (!phone || !audio || !conversationId || !messageDocId) {
    throw new functions.https.HttpsError("invalid-argument", "phone, audio, conversationId e messageDocId são obrigatórios");
  }

  const config = await getZApiConfig(context.auth.uid);

  const missing: string[] = [];
  if (!config.instanceId) missing.push("instanceId");
  if (!config.instanceToken) missing.push("instanceToken");
  if (!config.clientToken) missing.push("clientToken");
  if (!config.apiUrl) missing.push("apiUrl");
  if (missing.length > 0) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Configuração Z-API incompleta. Campos ausentes: ${missing.join(", ")}`
    );
  }

  const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-audio`;
  console.log("sendAudio - URL Z-API:", url);

  // Convert WebM to OGG/Opus if needed for WhatsApp waveform compatibility
  let finalAudio = audio;
  if (needsConversion(audio)) {
    console.log("sendAudio - Áudio em WebM detectado, iniciando conversão...");
    finalAudio = await convertWebmToOgg(audio);
  } else {
    console.log("sendAudio - Áudio já em formato compatível, enviando direto.");
  }

  const body = { phone, audio: finalAudio, waveform: true };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": config.clientToken,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log("sendAudio - Response status:", response.status, "body:", responseText);

  if (!response.ok) {
    throw new functions.https.HttpsError("internal", `Erro Z-API (${response.status}): ${responseText}`);
  }

  let result: { zaapId?: string; messageId?: string };
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    throw new functions.https.HttpsError("internal", "Resposta Z-API inválida (não é JSON)");
  }

  if (!result.messageId) {
    throw new functions.https.HttpsError("internal", "Z-API não retornou messageId");
  }

  const zapiMessageId = String(result.messageId);
  const msgDocRef = db.collection("conversations").doc(conversationId).collection("messages").doc(messageDocId);
  const encodedId = encodeURIComponent(zapiMessageId);
  const mapRef = db.collection("zapi_message_map").doc(encodedId);

  await Promise.all([
    msgDocRef.update({ zapiMessageId, status: "sent" }),
    mapRef.set({
      conversationId,
      messageDocId,
      zapiMessageId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
    db.collection("conversations").doc(conversationId).update({
      lastMessageStatus: "sent",
      lastMessageZapiMessageId: zapiMessageId,
      lastMessageIsFromMe: true,
    }),
  ]);

  console.log("sendAudio - Sucesso! zaapId:", result.zaapId, "messageId:", zapiMessageId);
  return { zaapId: result.zaapId, messageId: zapiMessageId };
});
