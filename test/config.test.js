import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../src/config.js";

const VALID_BASE_ENV = {
    DASHBOARD_SPREADSHEET_ID: "spreadsheet-123",
    RED_TAG_SHEET_NAME: "Red Tag",
    ORANGE_TAG_SHEET_NAME: "Orange Tag",
    WORK_REQUEST_SHEET_NAME: "WR",
    TECHNICIAN_SHEET_NAME: "Data Teknisi"
};

test("loadConfig berhasil dengan GOOGLE_APPLICATION_CREDENTIALS", () => {
    const config = loadConfig({
        ...VALID_BASE_ENV,
        GOOGLE_APPLICATION_CREDENTIALS: "./credentials/service-account.json"
    });

    assert.equal(config.spreadsheetId, "spreadsheet-123");
    assert.equal(config.sheetNames.redTag, "Red Tag");
    assert.equal(config.googleCredentials, null);
    assert.equal(config.authStateDir, "auth_info");
});

test("loadConfig berhasil dengan GOOGLE_SERVICE_ACCOUNT_JSON", () => {
    const fakeServiceAccount = { client_email: "test@example.com", private_key: "abc" };
    const config = loadConfig({
        ...VALID_BASE_ENV,
        GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(fakeServiceAccount),
        AUTH_STATE_DIR: "custom_auth"
    });

    assert.deepEqual(config.googleCredentials, fakeServiceAccount);
    assert.equal(config.authStateDir, "custom_auth");
});

test("loadConfig gagal jika kedua kredensial Google tidak ada", () => {
    assert.throws(
        () => loadConfig({ ...VALID_BASE_ENV }),
        /GOOGLE_APPLICATION_CREDENTIALS atau GOOGLE_SERVICE_ACCOUNT_JSON/
    );
});

test("loadConfig gagal jika GOOGLE_SERVICE_ACCOUNT_JSON bukan JSON valid", () => {
    assert.throws(
        () => loadConfig({ ...VALID_BASE_ENV, GOOGLE_SERVICE_ACCOUNT_JSON: "invalid json string" }),
        /GOOGLE_SERVICE_ACCOUNT_JSON bukan format JSON yang valid/
    );
});

test("loadConfig gagal jika WHATSAPP_PHONE_NUMBER mengandung huruf", () => {
    assert.throws(
        () => loadConfig({
            ...VALID_BASE_ENV,
            GOOGLE_APPLICATION_CREDENTIALS: "./credentials/service-account.json",
            WHATSAPP_PHONE_NUMBER: "abc628123"
        }),
        /WHATSAPP_PHONE_NUMBER hanya boleh angka/
    );
});
