// Muat konfigurasi dari environment variables
export function loadConfig(env = process.env) {
    const spreadsheetId = env.SPREADSHEET_ID?.trim() || env.DASHBOARD_SPREADSHEET_ID?.trim();
    if (!spreadsheetId) {
        throw new Error("Konfigurasi SPREADSHEET_ID atau DASHBOARD_SPREADSHEET_ID wajib diisi di file .env");
    }

    let googleCredentials = null;
    let rawJson = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    const credentialsPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

    // Jika user mem-paste teks JSON langsung ke GOOGLE_APPLICATION_CREDENTIALS
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
        throw new Error("GOOGLE_APPLICATION_CREDENTIALS atau GOOGLE_SERVICE_ACCOUNT_JSON wajib diisi di .env");
    }

    const whatsAppPhoneNumber = env.WHATSAPP_PHONE_NUMBER?.trim() || null;
    if (whatsAppPhoneNumber && !/^\d+$/.test(whatsAppPhoneNumber)) {
        throw new Error("WHATSAPP_PHONE_NUMBER hanya boleh angka dengan kode negara, contoh 6285173090438");
    }

    const tasksSheetName = env.TASKS_SHEET_NAME?.trim() || "Sheet1";

    const allowedGroupIds = (env.ALLOWED_GROUP_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

    const adminNumbers = (env.ADMIN_NUMBERS ?? "")
        .split(",")
        .map((num) => num.replace(/\D/g, "").replace(/^0/, "62").trim())
        .filter(Boolean);

    return {
        spreadsheetId,
        tasksSheetName,
        allowedGroupIds,
        adminNumbers,
        googleCredentials,
        authStateDir: env.AUTH_STATE_DIR?.trim() || "auth_info",
        geminiApiKey: env.GEMINI_API_KEY?.trim() || null,
        geminiModel: env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite",
        whatsAppPhoneNumber
    };
}
