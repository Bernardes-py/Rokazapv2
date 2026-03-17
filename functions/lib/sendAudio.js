"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAudio = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const zapiConfig_1 = require("./zapiConfig");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
async function convertWebmToOgg(base64Data) {
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
    }
    finally {
        // Cleanup
        try {
            fs.unlinkSync(inputPath);
        }
        catch (_) { }
        try {
            fs.unlinkSync(outputPath);
        }
        catch (_) { }
    }
}
function needsConversion(audio) {
    return audio.startsWith("data:audio/webm");
}
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
exports.sendAudio = functions.runWith({ timeoutSeconds: 120, memory: "512MB" }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { phone, audio, conversationId, messageDocId } = data;
    console.log("sendAudio - Payload recebido:", JSON.stringify({ phone, audioLength: audio === null || audio === void 0 ? void 0 : audio.length, conversationId, messageDocId }));
    if (!phone || !audio || !conversationId || !messageDocId) {
        throw new functions.https.HttpsError("invalid-argument", "phone, audio, conversationId e messageDocId são obrigatórios");
    }
    const config = await (0, zapiConfig_1.getZApiConfig)(context.auth.uid);
    const missing = [];
    if (!config.instanceId)
        missing.push("instanceId");
    if (!config.instanceToken)
        missing.push("instanceToken");
    if (!config.clientToken)
        missing.push("clientToken");
    if (!config.apiUrl)
        missing.push("apiUrl");
    if (missing.length > 0) {
        throw new functions.https.HttpsError("failed-precondition", `Configuração Z-API incompleta. Campos ausentes: ${missing.join(", ")}`);
    }
    const url = `${config.apiUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-audio`;
    console.log("sendAudio - URL Z-API:", url);
    // Convert WebM to OGG/Opus if needed for WhatsApp waveform compatibility
    let finalAudio = audio;
    if (needsConversion(audio)) {
        console.log("sendAudio - Áudio em WebM detectado, iniciando conversão...");
        finalAudio = await convertWebmToOgg(audio);
    }
    else {
        console.log("sendAudio - Áudio já em formato compatível, enviando direto.");
    }
    const body = { phone, audio: finalAudio, waveform: true };
    const response = await (0, node_fetch_1.default)(url, {
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
    let result;
    try {
        result = JSON.parse(responseText);
    }
    catch (e) {
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
//# sourceMappingURL=sendAudio.js.map