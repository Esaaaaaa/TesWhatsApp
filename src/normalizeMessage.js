import { isJidGroup, jidNormalizedUser } from "baileys";
import { ASIA_JAKARTA } from "./constants.js";

// Waktu ISO zona Jakarta
function toJakartaIsoString(date) {
    const localDateTime = date.toLocaleString("sv-SE", { timeZone: ASIA_JAKARTA });
    return `${localDateTime.replace(" ", "T")}+07:00`;
}

// Ambil teks pesan
function extractMessageText(content) {
    return content?.conversation ?? content?.extendedTextMessage?.text ?? null;
}

// Nomor HP pengirim (mendukung DM dan grup)
function extractSenderPhone(key) {
    if (!isJidGroup(key.remoteJid)) {
        return key.remoteJid ? jidNormalizedUser(key.remoteJid).split("@")[0] : null;
    }
    const phoneJid = [key.participant, key.participantAlt].find((jid) => jid?.endsWith("@s.whatsapp.net"));
    return phoneJid ? jidNormalizedUser(phoneJid).split("@")[0] : null;
}

// Ubah pesan Baileys menjadi objek terstandar, null jika pesan bukan teks valid atau dari bot sendiri
export function normalizeMessage(rawMessage) {
    const { key } = rawMessage;

    if (key.fromMe) {
        return null;
    }

    const messageText = extractMessageText(rawMessage.message);
    if (!messageText) {
        return null;
    }

    const isGroup = isJidGroup(key.remoteJid);
    const chatId = key.remoteJid;
    const senderPhone = extractSenderPhone(key);

    return {
        messageId: key.id,
        chatId,
        groupId: isGroup ? chatId : null,
        isGroup,
        senderName: rawMessage.pushName ?? (isGroup ? key.participant ?? "" : ""),
        senderPhone,
        messageText: messageText.trim(),
        mentionedJids: (rawMessage.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? []).map(jidNormalizedUser),
        receivedAt: toJakartaIsoString(new Date(Number(rawMessage.messageTimestamp) * 1000)),
        rawMessage
    };
}
