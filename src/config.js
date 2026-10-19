const BASE_REQUIRED_ENV_KEYS = [
    "DASHBOARD_SPREADSHEET_ID",
    "RED_TAG_SHEET_NAME",
    "ORANGE_TAG_SHEET_NAME",
    "WORK_REQUEST_SHEET_NAME",
    "TECHNICIAN_SHEET_NAME"
];

// Baca dan cek isi environment variables
export function loadConfig(env = process.env) {
    const missingKeys = BASE_REQUIRED_ENV_KEYS.filter((key) => !env[key]?.trim());

    let googleCredentials = null;
    let rawJson = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

    // Jika user mem-paste teks JSON ke GOOGLE_APPLICATION_CREDENTIALS
    if (!rawJson && credentialsPath?.startsWith("{")) {
        rawJson = credentialsPath;
    }

    if (rawJson) {
        try {
            googleCredentials = JSON.parse(rawJson);
        } catch (error) {
            throw new Error(`Kredensial Google Service Account bukan format JSON yang valid: ${error.message}`);
        }
    } else if (!credentialsPath) {
        missingKeys.push("GOOGLE_APPLICATION_CREDENTIALS atau GOOGLE_SERVICE_ACCOUNT_JSON");
    }

    if (missingKeys.length > 0) {
        throw new Error(`Isi konfigurasi env belum lengkap: ${missingKeys.join(", ")}, lihat contohnya di .env.example`);
    }

    const whatsAppPhoneNumber = env.WHATSAPP_PHONE_NUMBER?.trim() || null;

    if (whatsAppPhoneNumber && !/^\d+$/.test(whatsAppPhoneNumber)) {
        throw new Error("WHATSAPP_PHONE_NUMBER hanya boleh angka dengan kode negara, contoh 6281234567890");
    }

    return {
        allowedGroupIds: (env.ALLOWED_GROUP_IDS ?? "").split(",").map((groupId) => groupId.trim()).filter(Boolean),
        spreadsheetId: env.DASHBOARD_SPREADSHEET_ID.trim(),
        sheetNames: {
            redTag: env.RED_TAG_SHEET_NAME.trim(),
            orangeTag: env.ORANGE_TAG_SHEET_NAME.trim(),
            workRequest: env.WORK_REQUEST_SHEET_NAME.trim()
        },
        technicianSheetName: env.TECHNICIAN_SHEET_NAME.trim(),
        googleCredentials,
        authStateDir: env.AUTH_STATE_DIR?.trim() || "auth_info",
        geminiApiKey: env.GEMINI_API_KEY?.trim() || null,
        geminiModel: env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest",
        whatsAppPhoneNumber
    };
}