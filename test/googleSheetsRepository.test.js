import test from "node:test";
import assert from "node:assert/strict";
import { formatRupiah, normalizePhone, normalizeTaskId, parseNumber } from "../src/googleSheetsRepository.js";

test("normalizePhone mengubah berbagai format nomor ke awalan 62", () => {
    assert.equal(normalizePhone("081234567890"), "6281234567890");
    assert.equal(normalizePhone("+62 812-3456-7890"), "6281234567890");
    assert.equal(normalizePhone("6281234567890"), "6281234567890");
});

test("formatRupiah memformat angka dengan pemisah ribuan titik", () => {
    assert.equal(formatRupiah(250000), "250.000");
    assert.equal(formatRupiah(1500000), "1.500.000");
    assert.equal(formatRupiah(0), "0");
});

test("parseNumber membersihkan teks menjadi integer", () => {
    assert.equal(parseNumber("Rp 250.000"), 250000);
    assert.equal(parseNumber("150000"), 150000);
    assert.equal(parseNumber(""), 0);
});

test("normalizeTaskId menstandarkan variasi ID tugas", () => {
    assert.equal(normalizeTaskId("t1"), "T1");
    assert.equal(normalizeTaskId("T01"), "T1");
    assert.equal(normalizeTaskId("T014"), "T14");
    assert.equal(normalizeTaskId("5"), "T5");
});
