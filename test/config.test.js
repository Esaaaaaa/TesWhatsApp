import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

const VALID_ENV = {
    SPREADSHEET_ID: "test-sheet-id",
    TASKS_SHEET_NAME: "Sheet1",
    GOOGLE_APPLICATION_CREDENTIALS: "./credentials/service-account.json"
};

test("loadConfig berhasil dengan SPREADSHEET_ID dan GOOGLE_APPLICATION_CREDENTIALS", () => {
    const config = loadConfig(VALID_ENV);
    assert.equal(config.spreadsheetId, "test-sheet-id");
    assert.equal(config.tasksSheetName, "Sheet1");
});

test("loadConfig berhasil dengan DASHBOARD_SPREADSHEET_ID untuk kompatibilitas", () => {
    const config = loadConfig({
        DASHBOARD_SPREADSHEET_ID: "legacy-id",
        GOOGLE_APPLICATION_CREDENTIALS: "./credentials/service-account.json"
    });
    assert.equal(config.spreadsheetId, "legacy-id");
});

test("loadConfig berhasil dengan GOOGLE_SERVICE_ACCOUNT_JSON", () => {
    const jsonStr = JSON.stringify({ project_id: "test", client_email: "test@appspot.gserviceaccount.com" });
    const config = loadConfig({
        SPREADSHEET_ID: "test-id",
        GOOGLE_SERVICE_ACCOUNT_JSON: jsonStr
    });
    assert.equal(config.googleCredentials?.client_email, "test@appspot.gserviceaccount.com");
});

test("loadConfig gagal jika SPREADSHEET_ID tidak ada", () => {
    assert.throws(
        () => loadConfig({ GOOGLE_APPLICATION_CREDENTIALS: "path.json" }),
        /SPREADSHEET_ID/
    );
});

test("loadConfig gagal jika kredensial Google tidak ada", () => {
    assert.throws(
        () => loadConfig({ SPREADSHEET_ID: "test-id" }),
        /GOOGLE_APPLICATION_CREDENTIALS/
    );
});

test("loadConfig memvalidasi format WHATSAPP_PHONE_NUMBER hanya angka", () => {
    assert.throws(
        () => loadConfig({ ...VALID_ENV, WHATSAPP_PHONE_NUMBER: "+62 812-345" }),
        /WHATSAPP_PHONE_NUMBER/
    );
});
