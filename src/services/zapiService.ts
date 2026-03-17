import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

const functions = app ? getFunctions(app, 'us-central1') : null;

interface SendMessageResult {
  zaapId: string;
  messageId: string;
}

interface ConnectionStatus {
  connected: boolean;
  phone?: string;
  error?: string;
}

export async function sendTextViaZApi(
  phone: string,
  message: string,
  conversationId: string,
  messageDocId: string
): Promise<SendMessageResult> {
  console.log('[zapiService] functions instance:', functions ? 'OK' : 'NULL');
  if (!functions) throw new Error('Firebase não configurado');

  const callable = httpsCallable<
    { phone: string; message: string; conversationId: string; messageDocId: string },
    SendMessageResult
  >(functions, 'sendMessage');

  const params = { phone, message, conversationId, messageDocId };
  console.log('[zapiService] Chamando Cloud Function sendMessage com:', JSON.stringify(params));
  const result = await callable(params);
  console.log('[zapiService] Resultado:', JSON.stringify(result.data));
  return result.data;
}

export async function testZApiConnection(): Promise<ConnectionStatus> {
  if (!functions) throw new Error('Firebase não configurado');

  const callable = httpsCallable<Record<string, never>, ConnectionStatus>(
    functions,
    'testConnection'
  );

  const result = await callable({});
  return result.data;
}

// Mobile Registration functions

interface RegistrationAvailableResult {
  available: boolean;
  [key: string]: unknown;
}

export async function checkRegistrationAvailable(ddi: string, phone: string): Promise<RegistrationAvailableResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<{ ddi: string; phone: string }, RegistrationAvailableResult>(functions, 'checkRegistrationAvailable');
  const result = await callable({ ddi, phone });
  return result.data;
}

interface RequestCodeResult {
  success?: boolean;
  captcha?: string; // base64 image
  retryAfter?: number;
  smsWaitSeconds?: number;
  banned?: boolean;
  [key: string]: unknown;
}

export async function requestRegistrationCode(ddi: string, phone: string, method: string): Promise<RequestCodeResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<{ ddi: string; phone: string; method: string }, RequestCodeResult>(functions, 'requestRegistrationCode');
  const result = await callable({ ddi, phone, method });
  return result.data;
}

interface ConfirmCodeResult {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export async function confirmRegistrationCode(code: string): Promise<ConfirmCodeResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<{ code: string }, ConfirmCodeResult>(functions, 'confirmRegistrationCode');
  const result = await callable({ code });
  return result.data;
}

interface CaptchaResult {
  success?: boolean;
  [key: string]: unknown;
}

export async function respondCaptcha(captcha: string): Promise<CaptchaResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<{ captcha: string }, CaptchaResult>(functions, 'respondCaptcha');
  const result = await callable({ captcha });
  return result.data;
}

// Image sending

interface SendImageResult {
  zaapId: string;
  messageId: string;
}

export async function sendImageViaZApi(
  phone: string,
  imageBase64: string,
  caption: string,
  conversationId: string,
  messageDocId: string
): Promise<SendImageResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; image: string; caption: string; conversationId: string; messageDocId: string },
    SendImageResult
  >(functions, 'sendImage');
  const result = await callable({ phone, image: imageBase64, caption, conversationId, messageDocId });
  return result.data;
}

// Sticker sending

interface SendStickerResult {
  zaapId: string;
  messageId: string;
}

export async function sendStickerViaZApi(
  phone: string,
  stickerBase64: string,
  conversationId: string,
  messageDocId: string
): Promise<SendStickerResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; sticker: string; conversationId: string; messageDocId: string },
    SendStickerResult
  >(functions, 'sendSticker');
  const result = await callable({ phone, sticker: stickerBase64, conversationId, messageDocId });
  return result.data;
}

// Audio sending

interface SendAudioResult {
  zaapId: string;
  messageId: string;
}

export async function sendAudioViaZApi(
  phone: string,
  audioBase64: string,
  conversationId: string,
  messageDocId: string
): Promise<SendAudioResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; audio: string; conversationId: string; messageDocId: string },
    SendAudioResult
  >(functions, 'sendAudio');
  const result = await callable({ phone, audio: audioBase64, conversationId, messageDocId });
  return result.data;
}

// GIF sending

interface SendGifResult {
  zaapId: string;
  messageId: string;
}

export async function sendGifViaZApi(
  phone: string,
  gifUrl: string,
  caption: string,
  conversationId: string,
  messageDocId: string
): Promise<SendGifResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; gif: string; caption: string; conversationId: string; messageDocId: string },
    SendGifResult
  >(functions, 'sendGif');
  const result = await callable({ phone, gif: gifUrl, caption, conversationId, messageDocId });
  return result.data;
}

// Document sending

interface SendDocumentResult {
  zaapId: string;
  messageId: string;
}

export async function sendDocumentViaZApi(
  phone: string,
  docBase64: string,
  fileName: string,
  conversationId: string,
  messageDocId: string
): Promise<SendDocumentResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; document: string; fileName: string; conversationId: string; messageDocId: string },
    SendDocumentResult
  >(functions, 'sendDocument');
  const result = await callable({ phone, document: docBase64, fileName, conversationId, messageDocId });
  return result.data;
}

// Link sending

interface SendLinkResult {
  zaapId: string;
  messageId: string;
}

export async function sendLinkViaZApi(
  phone: string,
  message: string,
  linkUrl: string,
  title: string,
  linkDescription: string,
  image: string,
  conversationId: string,
  messageDocId: string
): Promise<SendLinkResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; message: string; linkUrl: string; title: string; linkDescription: string; image: string; conversationId: string; messageDocId: string },
    SendLinkResult
  >(functions, 'sendLink');
  const result = await callable({ phone, message, linkUrl, title, linkDescription, image, conversationId, messageDocId });
  return result.data;
}

// OG Metadata fetching

interface OgMetadata {
  title: string;
  description: string;
  image: string;
}

export async function fetchOgMetadata(url: string): Promise<OgMetadata> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<{ url: string }, OgMetadata>(functions, 'fetchOgMetadata');
  const result = await callable({ url });
  return result.data;
}

// Video sending

interface SendVideoResult {
  zaapId: string;
  messageId: string;
}

export async function sendVideoViaZApi(
  phone: string,
  videoBase64: string,
  caption: string,
  conversationId: string,
  messageDocId: string
): Promise<SendVideoResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; video: string; caption: string; conversationId: string; messageDocId: string },
    SendVideoResult
  >(functions, 'sendVideo');
  const result = await callable({ phone, video: videoBase64, caption, conversationId, messageDocId });
  return result.data;
}

// Option List sending

interface SendOptionListResult {
  zaapId: string;
  messageId: string;
}

interface OptionListData {
  title: string;
  buttonLabel: string;
  options: Array<{ id?: string; title: string; description: string }>;
}

export async function sendOptionListViaZApi(
  phone: string,
  message: string,
  optionList: OptionListData,
  conversationId: string,
  messageDocId: string
): Promise<SendOptionListResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; message: string; optionList: OptionListData; conversationId: string; messageDocId: string },
    SendOptionListResult
  >(functions, 'sendOptionList');
  const result = await callable({ phone, message, optionList, conversationId, messageDocId });
  return result.data;
}

// Location sending

interface SendLocationResult {
  zaapId: string;
  messageId: string;
}

export async function sendLocationViaZApi(
  phone: string,
  title: string,
  address: string,
  latitude: number,
  longitude: number,
  conversationId: string,
  messageDocId: string
): Promise<SendLocationResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; title: string; address: string; latitude: number; longitude: number; conversationId: string; messageDocId: string },
    SendLocationResult
  >(functions, 'sendLocation');
  const result = await callable({ phone, title, address, latitude, longitude, conversationId, messageDocId });
  return result.data;
}

// Reaction sending

export async function sendReactionViaZApi(
  phone: string,
  messageId: string,
  emoji: string
): Promise<void> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; messageId: string; emoji: string },
    any
  >(functions, 'sendReaction');
  await callable({ phone, messageId, emoji });
}

// Contact sending

export async function sendContactViaZApi(
  phone: string,
  contactName: string,
  contactPhone: string,
  conversationId: string,
  messageDocId: string
): Promise<SendMessageResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; contactName: string; contactPhone: string; conversationId: string; messageDocId: string },
    SendMessageResult
  >(functions, 'sendContact');
  const result = await callable({ phone, contactName, contactPhone, conversationId, messageDocId });
  return result.data;
}

// Multiple contacts sending

export async function sendContactsViaZApi(
  phone: string,
  contacts: Array<{ name: string; phones: string[] }>,
  conversationId: string,
  messageDocId: string
): Promise<SendMessageResult> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; contacts: Array<{ name: string; phones: string[] }>; conversationId: string; messageDocId: string },
    SendMessageResult
  >(functions, 'sendContacts');
  const result = await callable({ phone, contacts, conversationId, messageDocId });
  return result.data;
}

// Forward message

export async function forwardMessageViaZApi(
  phone: string,
  messageId: string,
  messagePhone: string
): Promise<{ zaapId: string }> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; messageId: string; messagePhone: string },
    { zaapId: string }
  >(functions, 'forwardMessage');
  const result = await callable({ phone, messageId, messagePhone });
  return result.data;
}

// Delete chat

export async function deleteChatViaZApi(phone: string): Promise<{ success: boolean }> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<{ phone: string }, { success: boolean }>(functions, 'deleteChat');
  const result = await callable({ phone });
  return result.data;
}

// Block/unblock contact

export async function blockContactViaZApi(
  phone: string,
  action: 'block' | 'unblock',
  tenantId?: string
): Promise<unknown> {
  if (!functions) throw new Error('Firebase não configurado');
  const callable = httpsCallable<
    { phone: string; action: string; tenantId?: string },
    unknown
  >(functions, 'blockContact');
  const result = await callable({ phone, action, tenantId });
  return result.data;
}
