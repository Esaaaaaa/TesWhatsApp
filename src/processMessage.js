import {
    buildAiUnavailableMessage,
    buildCompletedMessage,
    buildHelpMessage,
    buildNotAdminMessage,
    buildPaymentMessage,
    buildRevisionMessage,
    buildTaskAddedMessage,
    buildTaskDeletedMessage,
    buildTaskDetailMessage,
    buildTaskListMessage
} from "./taskMessages.js";
import { PROCESSING_STATUS, TASK_STATUS } from "./constants.js";
import { logger } from "./logger.js";
import { normalizePhone, parseNumber } from "./googleSheetsRepository.js";

// Parsing perintah slash command
function parseCommand(text) {
    if (!text.startsWith("/")) return null;

    const firstSpaceIndex = text.indexOf(" ");
    const command = (firstSpaceIndex === -1 ? text : text.slice(0, firstSpaceIndex)).toLowerCase().trim();
    const args = firstSpaceIndex === -1 ? "" : text.slice(firstSpaceIndex + 1).trim();

    return { command, args };
}

// Proses pesan masuk (grup atau chat pribadi)
export async function processMessage(message, {
    allowedGroupIds = [],
    adminNumbers = [],
    taskRepository,
    aiAssistant,
    botJids = [],
    sendReply
}) {
    const { messageId, chatId, groupId, isGroup, senderName, senderPhone, messageText, mentionedJids } = message;

    // Filter grup jika ALLOWED_GROUP_IDS ditentukan
    if (isGroup && allowedGroupIds.length > 0 && !allowedGroupIds.includes(groupId)) {
        logger.info(`Pesan grup diabaikan karena grup belum diizinkan: groupId=${groupId}`);
        return PROCESSING_STATUS.IGNORED;
    }

    const mentionsBot = mentionedJids?.some((jid) => botJids.includes(jid));
    const isBotCommand = messageText.startsWith("/");

    // Di grup: hanya respon jika diawali slash command atau mention bot
    if (isGroup && !isBotCommand && !mentionsBot) {
        return PROCESSING_STATUS.IGNORED;
    }

    // Cek hak akses admin jika daftar ADMIN_NUMBERS diatur di .env
    const senderCleanPhone = normalizePhone(senderPhone);
    const isAdmin = adminNumbers.length === 0 || adminNumbers.includes(senderCleanPhone);

    logger.info(`Pesan diterima: sender=${senderName} phone=${senderCleanPhone} text="${messageText.slice(0, 50)}"`);

    // 1. Eksekusi Perintah Slash Command
    if (isBotCommand) {
        const parsed = parseCommand(messageText);
        if (!parsed) return PROCESSING_STATUS.IGNORED;

        const { command, args } = parsed;

        try {
            // Menu bantuan
            if (["/help", "/bantuan", "/menu"].includes(command)) {
                await sendReply(message, buildHelpMessage());
                return PROCESSING_STATUS.PROCESSED;
            }

            // Lihat daftar tugas aktif
            if (["/list", "/tugas"].includes(command)) {
                const isAll = args.toLowerCase() === "all";
                const tasks = isAll ? await taskRepository.getAllTasks() : await taskRepository.getActiveTasks();
                await sendReply(message, buildTaskListMessage(tasks));
                return PROCESSING_STATUS.PROCESSED;
            }

            // Perintah yang memerlukan hak akses admin (jika ADMIN_NUMBERS diisi)
            if (!isAdmin) {
                await sendReply(message, buildNotAdminMessage());
                return PROCESSING_STATUS.INVALID;
            }

            // Detail satu tugas
            if (command === "/detail") {
                if (!args) {
                    await sendReply(message, "⚠️ Tolong sebutkan ID tugas, contoh: `/detail T1`");
                    return PROCESSING_STATUS.INVALID;
                }
                const task = await taskRepository.findTaskById(args);
                if (!task) {
                    await sendReply(message, `⚠️ Tugas dengan ID *${args}* tidak ditemukan di spreadsheet.`);
                    return PROCESSING_STATUS.INVALID;
                }
                await sendReply(message, buildTaskDetailMessage(task));
                return PROCESSING_STATUS.PROCESSED;
            }

            // Tambah tugas baru: /tambah <No WA> - <Nama Tugas> - <Deadline> - [Jam] - <Harga> - [DP] - [PIC]
            if (command === "/tambah") {
                const parts = args.split(/\s+-\s+/).map((p) => p.trim());
                if (parts.length < 4) {
                    await sendReply(
                        message,
                        "⚠️ Format tidak lengkap!\nFormat:\n`/tambah <No WA> - <Nama Tugas> - <Deadline> - [Jam] - <Harga> - [DP] - [PIC]`\n\nContoh:\n• Tanpa jam:\n`/tambah 081234567890 - Makalah - 31-10-2026 - 250000 - 100000 - Rian`\n• Dengan jam:\n`/tambah 081234567890 - Makalah - 31-10-2026 - 20:00 - 250000 - 100000 - Rian`"
                    );
                    return PROCESSING_STATUS.INVALID;
                }

                const clientPhone = parts[0];
                const taskTitle = parts[1];
                const deadline = parts[2];
                const rest = parts.slice(3);

                // Cek apakah field setelah deadline adalah jam (format HH:mm atau HH.mm)
                let jam = "";
                let priceRaw = 0;
                let paidRaw = 0;
                let pic = "-";
                let notes = "";

                if (/^\d{1,2}[:.]\d{2}$/.test(rest[0])) {
                    // Ada jam di posisi ke-4
                    jam = rest[0].replace(".", ":");
                    priceRaw = rest[1] || 0;
                    paidRaw = rest[2] || 0;
                    pic = rest[3] || "-";
                    notes = rest[4] || "";
                } else {
                    // Tidak ada jam, langsung harga di posisi ke-4
                    priceRaw = rest[0] || 0;
                    paidRaw = rest[1] || 0;
                    pic = rest[2] || "-";
                    notes = rest[3] || "";
                }

                const createdTask = await taskRepository.addTask({
                    clientPhone: normalizePhone(clientPhone),
                    taskTitle,
                    deadline,
                    jam,
                    price: priceRaw,
                    paid: paidRaw,
                    pic,
                    notes,
                    receivedAt: message.receivedAt
                });

                await sendReply(message, buildTaskAddedMessage(createdTask));
                return PROCESSING_STATUS.PROCESSED;
            }

            // Catat pembayaran: /bayar <ID> <Nominal>
            if (command === "/bayar") {
                const parts = args.split(/\s+/).filter(Boolean);
                if (parts.length < 2) {
                    await sendReply(message, "⚠️ Format salah!\nContoh: `/bayar T1 150000`");
                    return PROCESSING_STATUS.INVALID;
                }
                const [idInput, amountRaw] = parts;
                const { task, addedAmount } = await taskRepository.addPayment(idInput, amountRaw);
                await sendReply(message, buildPaymentMessage(task, addedAmount));
                return PROCESSING_STATUS.PROCESSED;
            }

            // Tandai selesai: /selesai <ID>
            if (command === "/selesai") {
                if (!args) {
                    await sendReply(message, "⚠️ Tolong sebutkan ID tugas, contoh: `/selesai T1`");
                    return PROCESSING_STATUS.INVALID;
                }
                const updatedTask = await taskRepository.updateStatus(args, TASK_STATUS.SELESAI);
                await sendReply(message, buildCompletedMessage(updatedTask));
                return PROCESSING_STATUS.PROCESSED;
            }

            // Hapus tugas: /hapus <ID>
            if (command === "/hapus") {
                if (!args) {
                    await sendReply(message, "⚠️ Tolong sebutkan ID tugas, contoh: `/hapus T1`");
                    return PROCESSING_STATUS.INVALID;
                }
                const deletedTask = await taskRepository.deleteTask(args);
                await sendReply(message, buildTaskDeletedMessage(deletedTask));
                return PROCESSING_STATUS.PROCESSED;
            }

            // Tandai revisi: /revisi <ID> [catatan]
            if (command === "/revisi") {
                const firstSpace = args.indexOf(" ");
                const idInput = firstSpace === -1 ? args : args.slice(0, firstSpace);
                const notes = firstSpace === -1 ? null : args.slice(firstSpace + 1).trim();

                if (!idInput) {
                    await sendReply(message, "⚠️ Tolong sebutkan ID tugas, contoh: `/revisi T1 Bab 2 kurang sitasi`");
                    return PROCESSING_STATUS.INVALID;
                }

                const updatedTask = await taskRepository.updateStatus(idInput, TASK_STATUS.REVISI, notes);
                await sendReply(message, buildRevisionMessage(updatedTask, notes));
                return PROCESSING_STATUS.PROCESSED;
            }

            // Tandai sedang diproses: /proses <ID>
            if (command === "/proses") {
                if (!args) {
                    await sendReply(message, "⚠️ Tolong sebutkan ID tugas, contoh: `/proses T1`");
                    return PROCESSING_STATUS.INVALID;
                }
                const updatedTask = await taskRepository.updateStatus(args, TASK_STATUS.PROSES);
                await sendReply(message, `⏳ Status tugas *${updatedTask.id}* diubah menjadi *Proses*.`);
                return PROCESSING_STATUS.PROCESSED;
            }

            // Ganti PIC: /pic <ID> <Nama PIC>
            if (command === "/pic") {
                const firstSpace = args.indexOf(" ");
                if (firstSpace === -1) {
                    await sendReply(message, "⚠️ Format salah! Contoh: `/pic T1 Budi`");
                    return PROCESSING_STATUS.INVALID;
                }
                const idInput = args.slice(0, firstSpace).trim();
                const newPic = args.slice(firstSpace + 1).trim();
                const updatedTask = await taskRepository.updatePic(idInput, newPic);
                await sendReply(message, `👤 PIC tugas *${updatedTask.id}* berhasil diubah menjadi: *${updatedTask.pic}*`);
                return PROCESSING_STATUS.PROCESSED;
            }

            // Update catatan / link drive: /catatan <ID> <Teks Catatan>
            if (command === "/catatan") {
                const firstSpace = args.indexOf(" ");
                if (firstSpace === -1) {
                    await sendReply(message, "⚠️ Format salah! Contoh: `/catatan T1 link drive: https://...`");
                    return PROCESSING_STATUS.INVALID;
                }
                const idInput = args.slice(0, firstSpace).trim();
                const notes = args.slice(firstSpace + 1).trim();
                const updatedTask = await taskRepository.updateNotes(idInput, notes);
                await sendReply(message, `📝 Catatan tugas *${updatedTask.id}* berhasil diperbarui:\n"${updatedTask.notes}"`);
                return PROCESSING_STATUS.PROCESSED;
            }

            // Perintah tidak dikenal
            await sendReply(message, `⚠️ Perintah \`${command}\` tidak dikenali. Ketik */help* untuk melihat daftar perintah.`);
            return PROCESSING_STATUS.INVALID;
        } catch (error) {
            logger.error(`Gagal memproses perintah "${messageText}": ${error.message}`);
            await sendReply(message, `❌ Gagal: ${error.message}`);
            return PROCESSING_STATUS.ERROR;
        }
    }

    // 2. Tanya Jawab Cerdas dengan Model AI (Gemini)
    if (aiAssistant) {
        const question = messageText.replace(/@\d+/g, "").trim();
        if (!question) return PROCESSING_STATUS.IGNORED;

        try {
            logger.info(`Memproses pertanyaan AI: "${question}"`);
            const answer = await aiAssistant.ask(question, {
                sessionId: isGroup ? `${groupId}:${senderPhone}` : chatId,
                receivedAt: message.receivedAt
            });
            await sendReply(message, answer ?? buildAiUnavailableMessage());
            return answer ? PROCESSING_STATUS.PROCESSED : PROCESSING_STATUS.ERROR;
        } catch (error) {
            logger.error(`AI gagal menjawab: ${error.message}`);
            await sendReply(message, buildAiUnavailableMessage());
            return PROCESSING_STATUS.ERROR;
        }
    }

    return PROCESSING_STATUS.IGNORED;
}
