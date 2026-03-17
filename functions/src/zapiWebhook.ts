import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { getSuperlogicaConfig, SUPERLOGICA_BASE_URL } from "./superlogicaConfig";
import OpenAI from "openai";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── Name similarity helpers ──────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z\s]/g, "") // keep only letters and spaces
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

function tokenize(s: string): string[] {
  return normalize(s).split(" ").filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

function nameSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Containment check: all words of shorter name found in longer name
  const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  const allContained = shorter.every((w) => longer.some((l) => l === w || (w.length >= 3 && l.startsWith(w)) || (l.length >= 3 && w.startsWith(l))));
  if (allContained) return 0.8;

  // Word overlap with prefix matching
  let matches = 0;
  const used = new Set<number>();
  for (const wa of tokensA) {
    for (let i = 0; i < tokensB.length; i++) {
      if (used.has(i)) continue;
      const wb = tokensB[i];
      if (wa === wb || (wa.length >= 3 && wb.startsWith(wa)) || (wb.length >= 3 && wa.startsWith(wb))) {
        matches++;
        used.add(i);
        break;
      }
    }
  }

  const totalUnique = Math.max(tokensA.length, tokensB.length);
  return matches / totalUnique;
}

// ── Message type detection ───────────────────────────────────────────

function detectMessageType(body: any): { type: string; mediaUrl?: string; mediaMimeType?: string; mediaFileName?: string; linkUrl?: string; linkTitle?: string; linkDescription?: string; linkImage?: string } {
  if (body.image?.imageUrl) return { type: "image", mediaUrl: body.image.imageUrl, mediaMimeType: body.image.mimetype };
  if (body.audio?.audioUrl) return { type: "audio", mediaUrl: body.audio.audioUrl, mediaMimeType: body.audio.mimetype };
  if (body.video?.videoUrl) return { type: "video", mediaUrl: body.video.videoUrl, mediaMimeType: body.video.mimetype };
  if (body.document?.documentUrl) return { type: "document", mediaUrl: body.document.documentUrl, mediaMimeType: body.document.mimetype, mediaFileName: body.document.fileName };
  if (body.sticker?.stickerUrl) return { type: "sticker", mediaUrl: body.sticker.stickerUrl };
  if (body.location) return { type: "location" };
  if (body.contactMessage) return { type: "contact" };
  if (body.listResponseMessage) return { type: "text" };
  if (body.linkUrl || body.matchedText) {
    return {
      type: "link",
      linkUrl: body.linkUrl || body.matchedText || "",
      linkTitle: body.title || "",
      linkDescription: body.linkDescription || body.description || "",
      linkImage: body.thumbnail || body.image?.imageUrl || "",
    };
  }
  return { type: "text" };
}

function getMessageBody(body: any): string {
  if (body.listResponseMessage) {
    const lr = body.listResponseMessage;
    return lr.title || lr.description || "Resposta de lista";
  }
  if (body.text?.message) return body.text.message;
  if (body.image?.caption) return body.image.caption;
  if (body.video?.caption) return body.video.caption;
  if (body.document?.caption) return body.document.caption;
  if (body.location) return `📍 Localização: ${body.location.latitude}, ${body.location.longitude}`;
  if (body.contactMessage) return `👤 Contato: ${body.contactMessage.displayName || ""}`;
  if (body.sticker) return "🖼️ Sticker";
  if (body.audio) return "🎵 Áudio";
  if (body.image) return "📷 Imagem";
  if (body.video) return "🎬 Vídeo";
  if (body.document) return `📄 ${body.document.fileName || "Documento"}`;
  return "";
}

// ── Superlógica lookup ───────────────────────────────────────────────

function cleanPhoneLast8(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
}

interface SuperlogicaMatch {
  condoName: string;
  block: string;
  unit: string;
  superlogicaName: string;
}

async function findInSuperlogica(phone: string, tenantId?: string): Promise<SuperlogicaMatch | null> {
  const last8 = cleanPhoneLast8(phone);
  if (!last8) return null;

  console.log("findInSuperlogica - buscando para phone:", phone, "last8:", last8, "tenantId:", tenantId);

  const config = await getSuperlogicaConfig(tenantId);
  const headers = {
    "Content-Type": "application/json",
    app_token: config.appToken,
    access_token: config.accessToken,
  };

  const condoUrl = `${SUPERLOGICA_BASE_URL}/condominios/get?id=-1&somenteCondominiosAtivos=1&apenasColunasPrincipais=1`;
  const condoResp = await fetch(condoUrl, { method: "GET", headers });
  if (!condoResp.ok) {
    console.error("findInSuperlogica - erro ao buscar condominios:", condoResp.status);
    return null;
  }
  let condos: any[] = await condoResp.json();

  // Filter by condominioIds if configured for this tenant
  if (config.condominioIds && config.condominioIds.length > 0) {
    condos = condos.filter((c: any) => config.condominioIds!.includes(String(c.id_condominio_cond)));
    console.log("findInSuperlogica - filtered to", condos.length, "condominios for tenant:", tenantId);
  }

  for (const condo of condos) {
    const condoId = condo.id_condominio_cond;
    const condoName = condo.st_fantasia_cond || condo.st_nome_cond || condoId;

    let page = 1;
    while (true) {
      const unitsUrl = `${SUPERLOGICA_BASE_URL}/unidades/index?idCondominio=${condoId}&exibirDadosDosContatos=1&pagina=${page}&itensPorPagina=50`;
      const unitsResp = await fetch(unitsUrl, { method: "GET", headers });
      if (!unitsResp.ok) break;
      const units: any[] = await unitsResp.json();
      if (!Array.isArray(units) || units.length === 0) break;

      for (const unit of units) {
        const phoneFields: unknown[] = [unit.celular_proprietario, unit.telefone_proprietario];
        const contatos = Array.isArray(unit.contatos) ? unit.contatos : [];
        for (const c of contatos) {
          phoneFields.push(c.st_telefone_con, c.st_celular_con, c.st_fone_con, c.st_fonecomercial_con, c.st_fone2_con, c.st_celular2_con);
        }

        const match = phoneFields.some((f) => {
          const cleaned = cleanPhoneLast8(f);
          return cleaned.length >= 8 && cleaned === last8;
        });

        if (match) {
          const bloco = unit.st_bloco_uni || "";
          const unidade = unit.st_unidade_uni || "";
          const contatoName = contatos.length > 0 ? (contatos[0].st_nome_con || "") : "";
          console.log("findInSuperlogica - match encontrado! condo:", condoName, "bloco:", bloco, "unidade:", unidade, "nome:", contatoName);
          return { condoName, block: bloco, unit: unidade, superlogicaName: contatoName };
        }
      }

      if (units.length < 50) break;
      page++;
    }
  }

  console.log("findInSuperlogica - nenhum match encontrado para:", phone);
  return null;
}

// ── Webhook principal ────────────────────────────────────────────────

export const zapiWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const body = req.body;
    console.log("zapiWebhook - payload (primeiros 500 chars):", JSON.stringify(body).substring(0, 500));

    // Handle incoming reaction events
    if (body.type === "reaction" || body.reaction) {
      await handleIncomingReaction(body);
      res.status(200).send("OK - reaction");
      return;
    }

    const phone = body.phone?.replace("@c.us", "") || "";
    const fromMe = Boolean(body.fromMe);
    const zapiMessageId = body.messageId || "";
    const instanceId = body.instanceId || "";

    console.log("zapiWebhook - instanceId recebido:", JSON.stringify(instanceId), "phone:", phone, "fromMe:", fromMe);

    if (!phone) {
      res.status(400).send("Phone missing");
      return;
    }

    // Ignorar IDs internos do WhatsApp (linked devices, newsletters, groups)
    if (phone.includes("@lid") || phone.includes("@newsletter") || phone.includes("@g.us")) {
      console.log("zapiWebhook - ignorando ID interno:", phone);
      res.status(200).send("OK - internal ID ignored");
      return;
    }

    if (fromMe && zapiMessageId) {
      const encodedId = encodeURIComponent(zapiMessageId);
      const mappedDoc = await db.collection("zapi_message_map").doc(encodedId).get();
      if (mappedDoc.exists) {
        console.log("zapiWebhook - fromMe duplicado ignorado (já mapeado):", zapiMessageId);
        res.status(200).send("OK - fromMe duplicate");
        return;
      }
    }

    // Buscar ownerId e tenantId a partir do instanceId
    let ownerId = "";
    let tenantId = "";
    

    if (instanceId) {
      const configSnapshot = await db.collection("zapi_config")
        .where("instanceId", "==", instanceId)
        .limit(1)
        .get();

      if (!configSnapshot.empty) {
        const configDoc = configSnapshot.docs[0];
        const configData = configDoc.data() || {};
        const ownerFromConfig = String(configData.ownerId || "").trim();
        ownerId = ownerFromConfig;
        tenantId = String(configData.tenantId || "");
        console.log("zapiWebhook - ownerId encontrado por instanceId:", ownerId || "(vazio)", "tenantId:", tenantId, "docId:", configDoc.id);
      }
    }

    if (!ownerId) {
      // Fallback seguro: tentar reaproveitar ownerId da conversa já existente para este telefone
      // (evita escolher config aleatória de outro tenant)
      const previousConvSnap = await db.collection("conversations")
        .where("contactPhone", "==", phone)
        .limit(5)
        .get();

      for (const convDoc of previousConvSnap.docs) {
        const convData = convDoc.data() || {};
        const participants: string[] = Array.isArray(convData.participants) ? convData.participants : [];
        const candidateOwner = participants.find((p) => p && p !== phone);
        if (candidateOwner) {
          ownerId = candidateOwner;
          tenantId = String(convData.tenantId || tenantId || "");
          console.log("zapiWebhook - fallback por conversa existente. ownerId:", ownerId, "tenantId:", tenantId, "conversationId:", convDoc.id);
          break;
        }
      }
    }

    if (!ownerId) {
      console.error("zapiWebhook - Nenhum ownerId encontrado. instanceId:", instanceId);
      res.status(400).send("Owner not found");
      return;
    }

    // Buscar ou criar conversa (filtrar por tenantId se disponível)
    const convQueryBase = db.collection("conversations").where("contactPhone", "==", phone);
    const convsSnapshot = tenantId
      ? await convQueryBase.where("tenantId", "==", tenantId).limit(1).get()
      : await convQueryBase.limit(1).get();

    let conversationId: string;
    const isNewConversation = convsSnapshot.empty;

    if (!convsSnapshot.empty) {
      const convDoc = convsSnapshot.docs[0];
      conversationId = convDoc.id;
      const participants: string[] = convDoc.data().participants || [];
      if (!participants.includes(ownerId)) {
        await db.collection("conversations").doc(conversationId).update({
          participants: admin.firestore.FieldValue.arrayUnion(ownerId),
        });
      }
    } else {
      const senderName = body.senderName || body.chatName || phone;
      const newConvData: any = {
        participants: [ownerId, phone],
        contactId: phone,
        contactName: senderName,
        contactPhone: phone,
        contactAvatar: body.photo || "",
        contactIsOnline: true,
        contactStatus: "",
        unreadCount: fromMe ? 0 : 1,
        isPinned: false,
        isFavorite: false,
        isMuted: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (tenantId) newConvData.tenantId = tenantId;
      const newConv = await db.collection("conversations").add(newConvData);
      conversationId = newConv.id;
    }

    // ── Auto-cadastro inteligente (somente mensagens recebidas) ──────────────────────────────────
    if (!fromMe) {
      const senderName = body.senderName || body.chatName || phone;
      const senderPhoto = body.photo || "";

      // Helper to add tenantId to contact data
      const withTenant = (data: any) => tenantId ? { ...data, tenantId } : data;

      let contactQuery = db.collection("contacts").where("phone", "==", phone);
      if (tenantId) contactQuery = contactQuery.where("tenantId", "==", tenantId);
      const contactSnap = await contactQuery.limit(1).get();

      if (contactSnap.empty) {
        // Contato NÃO existe pelo telefone — buscar na Superlógica
        let superMatch: SuperlogicaMatch | null = null;
        try {
          superMatch = await findInSuperlogica(phone, tenantId);
        } catch (err) {
          console.error("zapiWebhook - erro findInSuperlogica:", err);
        }

        if (superMatch && superMatch.superlogicaName) {
          const similarity = nameSimilarity(senderName, superMatch.superlogicaName);
          console.log("zapiWebhook - nameSimilarity:", similarity.toFixed(2),
            "whatsapp:", JSON.stringify(senderName),
            "superlogica:", JSON.stringify(superMatch.superlogicaName));

          if (similarity >= 0.4) {
            // Nomes semelhantes → buscar contato existente no Firestore pelo nome da Superlógica e atualizar
            let existingByNameQuery = db.collection("contacts")
              .where("condominium", "==", superMatch.condoName)
              .where("block", "==", superMatch.block)
              .where("unit", "==", superMatch.unit);
            if (tenantId) existingByNameQuery = existingByNameQuery.where("tenantId", "==", tenantId);
            const existingByName = await existingByNameQuery.limit(1).get();

            if (!existingByName.empty) {
              const updateFields: any = {
                phone,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              };
              if (senderPhoto) updateFields.avatar = senderPhoto;
              await existingByName.docs[0].ref.update(updateFields);
              console.log("zapiWebhook - contato existente atualizado com phone:", phone);
            } else {
              // Não encontrou no Firestore, cria com dados da Superlógica
              await db.collection("contacts").add(withTenant({
                phone, name: senderName, avatar: senderPhoto,
                email: "", cpf: "", condominium: superMatch.condoName,
                block: superMatch.block, unit: superMatch.unit,
                address: "", customNotes: "", tags: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }));
              console.log("zapiWebhook - contato criado com dados Superlógica (nome similar):", phone);
            }
          } else {
            // Nomes diferentes → criar novo contato com dados de moradia copiados
            await db.collection("contacts").add(withTenant({
              phone, name: senderName, avatar: senderPhoto,
              email: "", cpf: "", condominium: superMatch.condoName,
              block: superMatch.block, unit: superMatch.unit,
              address: "", customNotes: "", tags: [],
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }));
            console.log("zapiWebhook - novo contato criado (nome diferente) com moradia copiada:", phone,
              "whatsapp:", senderName, "superlogica:", superMatch.superlogicaName);
          }
        } else {
          // Sem match na Superlógica → criar contato vazio
          await db.collection("contacts").add(withTenant({
            phone, name: senderName, avatar: senderPhoto,
            email: "", cpf: "",
            condominium: superMatch?.condoName || "", block: superMatch?.block || "",
            unit: superMatch?.unit || "",
            address: "", customNotes: "", tags: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }));
          console.log("zapiWebhook - contato auto-cadastrado (sem match Superlógica):", phone);
        }
      } else {
        // Contato já existe — atualizar foto se disponível
        const existingContact = contactSnap.docs[0].data();
        const existingName = existingContact.name || "";

        if (senderPhoto) {
          await contactSnap.docs[0].ref.update({
            avatar: senderPhoto,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Se o nome do WhatsApp é diferente do cadastrado, atualizar o nome na conversa
        const similarity = nameSimilarity(senderName, existingName);
        if (similarity < 0.4 && senderName && senderName !== phone) {
          await db.collection("conversations").doc(conversationId).update({
            contactName: senderName,
          });

          // Criar contato separado se não existir com mesmo nome+telefone
          let existingByNamePhoneQuery = db.collection("contacts")
            .where("phone", "==", phone)
            .where("name", "==", senderName);
          if (tenantId) existingByNamePhoneQuery = existingByNamePhoneQuery.where("tenantId", "==", tenantId);
          const existingByNamePhone = await existingByNamePhoneQuery.limit(1).get();

          if (existingByNamePhone.empty) {
            await db.collection("contacts").add(withTenant({
              phone,
              name: senderName,
              avatar: senderPhoto || "",
              email: "",
              cpf: "",
              condominium: existingContact.condominium || "",
              block: existingContact.block || "",
              unit: existingContact.unit || "",
              address: "",
              customNotes: "",
              tags: [],
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }));
            console.log("zapiWebhook - contato separado criado:", senderName, "phone:", phone);
          }

          console.log("zapiWebhook - nome diferente detectado. Conversa atualizada para:", senderName,
            "(cadastro mantém:", existingName, ", similarity:", similarity.toFixed(2), ")");
        }
      }
    }

    // Detectar tipo e gravar mensagem
    const { type, mediaUrl, mediaMimeType, mediaFileName, linkUrl, linkTitle, linkDescription, linkImage } = detectMessageType(body);
    const messageBody = getMessageBody(body);

    const messageData: any = {
      conversationId,
      from: fromMe ? "me" : phone,
      to: fromMe ? phone : "me",
      body: messageBody,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: fromMe ? "sent" : "received",
      type,
      isFromMe: fromMe,
      zapiMessageId,
    };

    if (mediaUrl) messageData.mediaUrl = mediaUrl;
    if (mediaMimeType) messageData.mediaMimeType = mediaMimeType;
    if (mediaFileName) messageData.mediaFileName = mediaFileName;
    if (body.document?.fileSize) messageData.mediaFileSize = body.document.fileSize;
    if (linkUrl) messageData.linkUrl = linkUrl;
    if (linkTitle) messageData.linkTitle = linkTitle;
    if (linkDescription) messageData.linkDescription = linkDescription;
    if (linkImage) messageData.linkImage = linkImage;
    if (body.location) {
      messageData.latitude = body.location.latitude;
      messageData.longitude = body.location.longitude;
    }

    await db.collection("conversations").doc(conversationId).collection("messages").add(messageData);

    // Atualizar conversa
    const conversationUpdate: any = {
      lastMessageBody: messageBody,
      lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageStatus: fromMe ? "sent" : "received",
      lastMessageIsFromMe: fromMe,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!fromMe) {
      conversationUpdate.unreadCount = admin.firestore.FieldValue.increment(1);
    }

    await db.collection("conversations").doc(conversationId).update(conversationUpdate);

    console.log("zapiWebhook - conversationId:", conversationId, "isNew:", isNewConversation, "fromMe:", fromMe);

    // ── Auto-resposta ChatGPT fora do horário (somente mensagens recebidas) ──────────────────────────
    if (!fromMe) {
      try {
        await handleChatbotAutoReply(ownerId, conversationId, phone, messageBody, instanceId, tenantId);
      } catch (botErr) {
        console.error("zapiWebhook - erro na auto-resposta:", botErr);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Erro no webhook:", error);
    res.status(500).send("Internal Error");
  }
});

// ── Reaction handling ────────────────────────────────────────────────

async function handleIncomingReaction(body: any): Promise<void> {
  const reactionEmoji = body.reaction?.emoji || body.emoji || "";
  const referenceMessageId = body.reaction?.referenceMessageId || body.referenceMessageId || body.messageId || "";
  const phone = (body.phone || "").replace("@c.us", "");

  if (!reactionEmoji || !referenceMessageId) return;

  console.log("zapiWebhook - incoming reaction:", reactionEmoji, "on message:", referenceMessageId);

  const encodedId = encodeURIComponent(referenceMessageId);
  const mapDoc = await db.collection("zapi_message_map").doc(encodedId).get();

  if (!mapDoc.exists) {
    const convsSnapshot = await db.collection("conversations")
      .where("contactPhone", "==", phone).limit(1).get();
    if (convsSnapshot.empty) return;

    const convId = convsSnapshot.docs[0].id;
    const msgsSnapshot = await db.collection("conversations").doc(convId).collection("messages")
      .where("zapiMessageId", "==", referenceMessageId).limit(1).get();
    if (msgsSnapshot.empty) return;

    await applyReaction(convId, msgsSnapshot.docs[0].id, reactionEmoji, phone);
    return;
  }

  const mapData = mapDoc.data()!;
  await applyReaction(mapData.conversationId, mapData.messageDocId, reactionEmoji, phone);
}

async function applyReaction(conversationId: string, messageDocId: string, emoji: string, userId: string): Promise<void> {
  const msgRef = db.collection("conversations").doc(conversationId).collection("messages").doc(messageDocId);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) return;

  const data = msgSnap.data()!;
  const reactions: Record<string, string[]> = data.reactions || {};

  for (const key of Object.keys(reactions)) {
    reactions[key] = reactions[key].filter((u: string) => u !== userId);
    if (reactions[key].length === 0) delete reactions[key];
  }

  if (emoji) {
    reactions[emoji] = [...(reactions[emoji] || []), userId];
  }

  await msgRef.update({ reactions });
}

// ── Chatbot auto-reply logic ─────────────────────────────────────────

interface ChatbotConfig {
  enabled: boolean;
  openaiApiKey: string;
  systemPrompt: string;
  absenceMessage: string;
  schedule: Record<string, { enabled: boolean; start: string; end: string }>;
  timezone: string;
}

function isWithinSchedule(config: ChatbotConfig): boolean {
  const tz = config.timezone || "America/Sao_Paulo";
  const now = new Date();
  
  // Get current time in the configured timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")?.value?.toLowerCase() || "";
  const hour = parts.find(p => p.type === "hour")?.value || "00";
  const minute = parts.find(p => p.type === "minute")?.value || "00";
  const currentTime = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

  const daySchedule = config.schedule[weekday];
  if (!daySchedule || !daySchedule.enabled) return false;

  return currentTime >= daySchedule.start && currentTime <= daySchedule.end;
}

async function handleChatbotAutoReply(
  ownerId: string,
  conversationId: string,
  phone: string,
  incomingMessage: string,
  instanceId: string,
  tenantId: string
): Promise<void> {
  // ── 1. Resolver chatbot_config com fallback robusto ──
  let resolvedOwnerId = ownerId;
  let configSnap = await db.collection("chatbot_config").doc(resolvedOwnerId).get();
  let configSource = configSnap.exists ? "owner_direct" : "";

  // Fallback A: participantes da conversa
  if (!configSnap.exists) {
    const convForOwnerSnap = await db.collection("conversations").doc(conversationId).get();
    const participants: string[] = Array.isArray(convForOwnerSnap.data()?.participants)
      ? convForOwnerSnap.data()!.participants
      : [];

    for (const candidateOwnerId of participants) {
      if (!candidateOwnerId || candidateOwnerId === phone) continue;
      const candidateConfigSnap = await db.collection("chatbot_config").doc(candidateOwnerId).get();
      if (candidateConfigSnap.exists) {
        resolvedOwnerId = candidateOwnerId;
        configSnap = candidateConfigSnap;
        configSource = "participants";
        console.log("zapiWebhook - chatbot_config resolvido por participants:", resolvedOwnerId);
        break;
      }
    }
  }

  // Fallback B: buscar qualquer chatbot_config do mesmo tenantId
  if (!configSnap.exists && tenantId) {
    const byTenant = await db.collection("chatbot_config")
      .where("tenantId", "==", tenantId)
      .limit(1)
      .get();
    if (!byTenant.empty) {
      configSnap = byTenant.docs[0];
      resolvedOwnerId = byTenant.docs[0].id;
      configSource = "tenant_fallback";
      console.log("zapiWebhook - chatbot_config resolvido por tenantId:", tenantId, "docId:", resolvedOwnerId);
    }
  }

  if (!configSnap.exists) {
    console.log("zapiWebhook - [SKIP:config_not_found] chatbot_config não encontrado. ownerId:", ownerId, "tenantId:", tenantId, "conversationId:", conversationId);
    return;
  }

  const config = configSnap.data() as ChatbotConfig;
  console.log("zapiWebhook - chatbot_config carregado. source:", configSource, "enabled:", config.enabled, "schedule:", JSON.stringify(config.schedule || {}));

  if (!config.enabled) {
    console.log("zapiWebhook - [SKIP:disabled] chatbot desativado. ownerId:", resolvedOwnerId);
    return;
  }

  // 2. Se está dentro do horário → atendente humano, não faz nada
  const ALWAYS_REPLY_TENANTS = ["AyGEjmRvU1bQiKQruiiE"]; // Campos Altos
  const forceAlwaysReply = ALWAYS_REPLY_TENANTS.includes(tenantId);
  if (!forceAlwaysReply && isWithinSchedule(config)) {
    console.log("zapiWebhook - [SKIP:within_schedule] dentro do horário comercial, sem auto-resposta");
    return;
  }

  // 3. Proteção anti-spam: checar lastBotReply
  const convSnap = await db.collection("conversations").doc(conversationId).get();
  const convData = convSnap.data();
  if (convData?.lastBotReply) {
    const lastReply = convData.lastBotReply.toDate ? convData.lastBotReply.toDate() : new Date(convData.lastBotReply);
    const diffSeconds = (Date.now() - lastReply.getTime()) / 1000;
    const botCooldownSeconds = 30;
    if (diffSeconds < botCooldownSeconds) {
      console.log("zapiWebhook - [SKIP:cooldown] última resposta bot há", Math.round(diffSeconds), "s, ignorando");
      return;
    }
  }

  // 4. Buscar config Z-API para enviar mensagem
  let zapiConfig: any = null;
  const zapiSnap = await db.collection("zapi_config").doc(resolvedOwnerId).get();
  if (zapiSnap.exists) {
    zapiConfig = zapiSnap.data();
  } else {
    const byInstance = await db.collection("zapi_config").where("instanceId", "==", instanceId).limit(1).get();
    if (!byInstance.empty) zapiConfig = byInstance.docs[0].data();
  }

  if (!zapiConfig) {
    console.log("zapiWebhook - [SKIP:zapi_config_missing] config Z-API não encontrada para envio bot. ownerId:", resolvedOwnerId);
    return;
  }

  let replyText = "";

  // 5. Se tem API Key → usar ChatGPT
  const resolvedApiKey = config.openaiApiKey || "";
  if (resolvedApiKey) {
    try {
      const openai = new OpenAI({ apiKey: resolvedApiKey });

      // Buscar últimas mensagens para contexto
      const recentMsgs = await db.collection("conversations").doc(conversationId)
        .collection("messages")
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: config.systemPrompt || "Você é um assistente virtual." },
      ];

      // Adicionar mensagens em ordem cronológica
      const sortedMsgs = recentMsgs.docs.reverse();
      for (const msgDoc of sortedMsgs) {
        const m = msgDoc.data();
        if (!m.body) continue;
        messages.push({
          role: m.isFromMe ? "assistant" : "user",
          content: m.body,
        });
      }

      console.log("zapiWebhook - chamando ChatGPT com", messages.length, "mensagens de contexto");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      replyText = completion.choices[0]?.message?.content?.trim() || "";
    } catch (aiErr: any) {
      console.error("zapiWebhook - erro ChatGPT:", aiErr?.message || aiErr);
      replyText = config.absenceMessage || "Estamos fora do horário de atendimento. Retornaremos em breve!";
    }
  } else {
    // 6. Sem API Key → mensagem de ausência fixa
    replyText = config.absenceMessage || "Estamos fora do horário de atendimento. O Síndico X estará disponível no próximo dia útil.";
  }

  if (!replyText) return;

  // 7. Enviar via Z-API
  const sendUrl = `${zapiConfig.apiUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.instanceToken}/send-text`;
  const sendResponse = await fetch(sendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": zapiConfig.clientToken,
    },
    body: JSON.stringify({ phone, message: replyText }),
  });

  const sendResult = await sendResponse.json();
  console.log("zapiWebhook - resposta bot enviada via Z-API:", JSON.stringify(sendResult));

  // 8. Salvar mensagem do bot no Firestore
  await db.collection("conversations").doc(conversationId).collection("messages").add({
    conversationId,
    from: "bot",
    to: phone,
    body: replyText,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    status: "sent",
    type: "text",
    isFromMe: true,
    isBotMessage: true,
  });

  // 9. Atualizar conversa
  await db.collection("conversations").doc(conversationId).update({
    lastMessageBody: replyText,
    lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageStatus: "sent",
    lastMessageIsFromMe: true,
    lastBotReply: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("zapiWebhook - auto-resposta bot concluída para conversa:", conversationId);
}
