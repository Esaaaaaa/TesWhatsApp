import fs from "node:fs";
import { createAiAssistant } from "./aiAssistant.js";
import { loadConfig } from "./config.js";
import { createTaskRepository } from "./googleSheetsRepository.js";
import { logger } from "./logger.js";
import { normalizeMessage } from "./normalizeMessage.js";
import { processMessage } from "./processMessage.js";
import { startWhatsAppClient } from "./whatsAppClient.js";

// Muat .env otomatis jika ada (untuk development lokal)
if (fs.existsSync(".env") && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env");
}

// Titik awal aplikasi bot WhatsApp Joki Tugas
async function main() {
    const config = loadConfig();
    const taskRepository = createTaskRepository(config);
    const aiAssistant = config.geminiApiKey ? createAiAssistant({ apiKey: config.geminiApiKey, model: config.geminiModel, taskRepository }) : null;

    if (config.allowedGroupIds.length === 0) {
        logger.info("ALLOWED_GROUP_IDS kosong: Bot dapat digunakan di semua grup dan chat pribadi.");
    } else {
        logger.info(`ALLOWED_GROUP_IDS aktif: [${config.allowedGroupIds.join(", ")}]`);
    }

    await startWhatsAppClient({
        phoneNumber: config.whatsAppPhoneNumber,
        authStateDir: config.authStateDir,
        onMessage: async (rawMessage, { sendReply, botJids }) => {
            const message = normalizeMessage(rawMessage);

            if (!message) {
                return;
            }

            await processMessage(message, {
                allowedGroupIds: config.allowedGroupIds,
                adminNumbers: config.adminNumbers,
                taskRepository,
                aiAssistant,
                botJids,
                sendReply
            });
        }
    });
}

main().catch((error) => {
    logger.error(`Aplikasi gagal dijalankan: ${error.message}`);
    process.exit(1);
});
