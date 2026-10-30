import { formatRupiah } from "./googleSheetsRepository.js";

// Balasan setelah tugas dihapus
export function buildTaskDeletedMessage(task) {
    return [
        "🗑️ *TUGAS DIHAPUS*",
        `ID Tugas *${task.id}* (${task.taskTitle}) berhasil dihapus dari daftar.`,
        `• Klien   : ${task.clientPhone}`,
        `• Harga   : Rp ${formatRupiah(task.price)}`,
        `• Status  : ${task.status}`,
        "",
        "Data tugas ini sudah dihapus permanen dari spreadsheet."
    ].join("\n");
}

// Format daftar tugas aktif
export function buildTaskListMessage(tasks) {
    if (!tasks || tasks.length === 0) {
        return "📋 *LIST TUGAS*\n\nTidak ada tugas yang sedang aktif saat ini. Semua tugas sudah selesai atau belum ada order baru.";
    }

    const lines = tasks.map((t) => {
        const pic = t.pic && t.pic !== "-" ? ` | ${t.pic}` : "";
        const deadlineDisplay = t.jam ? `${t.deadline} ${t.jam}` : t.deadline;
        return `${t.id} | ${t.clientPhone} | ${t.taskTitle} | ${deadlineDisplay}${pic}`;
    });

    return [
        "LIST TUGAS",
        ...lines,
        "---------------------------------",
        `Total: ${tasks.length} tugas aktif`,
        "Ketik /detail <ID> untuk info lengkap & sisa bayar."
    ].join("\n");
}

// Balasan setelah tugas baru ditambahkan
export function buildTaskAddedMessage(task) {
    const deadlineDisplay = task.jam ? `${task.deadline} ${task.jam}` : task.deadline;
    return [
        "✅ *TUGAS BERHASIL DITAMBAHKAN*",
        `ID Tugas  : ${task.id}`,
        `Klien     : ${task.clientPhone}`,
        `Tugas     : ${task.taskTitle}`,
        `Deadline  : ${deadlineDisplay}`,
        `Harga     : Rp ${formatRupiah(task.price)}`,
        `Terbayar  : Rp ${formatRupiah(task.paid)} (${task.paymentStatus})`,
        `Sisa      : Rp ${formatRupiah(task.balance)}`,
        `Status    : ${task.status}`,
        `PIC       : ${task.pic}`
    ].join("\n");
}

// Balasan setelah pembayaran dicatat
export function buildPaymentMessage(task, addedAmount) {
    const isLunas = task.paymentStatus.toLowerCase() === "lunas";
    return [
        "💰 *PEMBAYARAN DITERIMA*",
        `ID Tugas  : ${task.id} (${task.taskTitle})`,
        `Masuk     : +Rp ${formatRupiah(addedAmount)}`,
        `Total Byr : Rp ${formatRupiah(task.paid)} / Rp ${formatRupiah(task.price)}`,
        `Sisa      : Rp ${formatRupiah(task.balance)}`,
        `Status    : ${isLunas ? "LUNAS ✅" : task.paymentStatus}`
    ].join("\n");
}

// Balasan setelah tugas ditandai langsung lunas
export function buildPaidOffMessage(task, remainingBalance) {
    return [
        "🎉 *PEMBAYARAN LUNAS*",
        `ID Tugas  : ${task.id} (${task.taskTitle})`,
        `Pelunasan : +Rp ${formatRupiah(remainingBalance)}`,
        `Total Byr : Rp ${formatRupiah(task.paid)} / Rp ${formatRupiah(task.price)}`,
        "Sisa      : Rp 0",
        "Status    : LUNAS ✅"
    ].join("\n");
}

// Balasan saat tugas ditandai selesai
export function buildCompletedMessage(task) {
    return [
        "✅ *TUGAS SELESAI*",
        `ID Tugas *${task.id}* (${task.taskTitle}) berhasil ditandai *SELESAI*.`,
        "Tugas ini otomatis diarsipkan dan tidak muncul di daftar tugas aktif."
    ].join("\n");
}

// Balasan saat tugas masuk status revisi
export function buildRevisionMessage(task, notes) {
    return [
        "⚠️ *STATUS REVISI*",
        `ID Tugas : ${task.id} (${task.taskTitle})`,
        "Status   : Revisi",
        `Catatan  : ${notes || task.notes || "-"}`
    ].join("\n");
}

// Balasan detail lengkap satu tugas
export function buildTaskDetailMessage(task) {
    const deadlineDisplay = task.jam ? `${task.deadline} ${task.jam}` : task.deadline;
    return [
        `📄 *DETAIL TUGAS ${task.id}*`,
        `• Klien       : ${task.clientPhone}`,
        `• Jenis Tugas : ${task.taskTitle}`,
        `• Tgl Masuk   : ${task.createdAt}`,
        `• Deadline    : ${deadlineDisplay}`,
        `• Harga       : Rp ${formatRupiah(task.price)}`,
        `• Terbayar    : Rp ${formatRupiah(task.paid)}`,
        `• Sisa        : Rp ${formatRupiah(task.balance)}`,
        `• Status Byr  : ${task.paymentStatus}`,
        `• Status Tgs  : ${task.status}`,
        `• PIC         : ${task.pic}`,
        `• Catatan     : ${task.notes || "-"}`
    ].join("\n");
}

// Pesan bantuan daftar perintah
export function buildHelpMessage() {
    return [
        "📖 *PANDUAN PERINTAH BOT JOKI TUGAS*",
        "",
        "1. *Lihat Tugas Aktif*",
        "   `/list` atau `/tugas`",
        "",
        "2. *Tambah Tugas Baru*",
        "   `/tambah <No WA> - <Nama Tugas> - <Deadline> - [Jam] - <Harga> - [DP] - [PIC]`",
        "   _Jam opsional (format HH:mm)._",
        "   _Contoh tanpa jam: /tambah 081234567890 - Makalah - 31-10-2026 - 250000 - 100000 - Rian_",
        "   _Contoh dengan jam: /tambah 081234567890 - Makalah - 31-10-2026 - 20:00 - 250000 - 100000 - Rian_",
        "",
        "3. *Catat Pembayaran*",
        "   • Bayar cicilan/DP: `/bayar <ID> <Nominal>`",
        "     _Contoh: /bayar T1 150000_",
        "   • Langsung lunas: `/lunas <ID>`",
        "     _Contoh: /lunas T1_",
        "",
        "4. *Tandai Selesai*",
        "   `/selesai <ID>`",
        "   _Contoh: /selesai T1_",
        "",
        "5. *Tandai Revisi*",
        "   `/revisi <ID> [catatan revisi]`",
        "   _Contoh: /revisi T1 Bab 2 sitasi kurang_",
        "",
        "6. *Hapus Tugas*",
        "   `/hapus <ID>`",
        "   _Contoh: /hapus T1_",
        "",
        "7. *Lihat Detail Lengkap*",
        "   `/detail <ID>`",
        "   _Contoh: /detail T1_",
        "",
        "8. *Ganti PIC Pengerjaan*",
        "   `/pic <ID> <Nama>`",
        "   _Contoh: /pic T1 Budi_",
        "",
        "9. *Update Catatan/Link Drive*",
        "   `/catatan <ID> <teks>`",
        "   _Contoh: /catatan T1 link drive: https://..._",
        "",
        "🤖 *Tanya AI Bebas:*",
        "Tinggal tag bot, misal: `@Bot deadline besok ada tugas apa aja?`"
    ].join("\n");
}

export function buildNotAdminMessage() {
    return "⛔ Maaf, nomor Anda tidak terdaftar sebagai admin yang berwenang menjalankan perintah ini.";
}

export function buildAiUnavailableMessage() {
    return "Maaf, asisten AI sedang mengalami kendala. Silakan coba kembali beberapa saat lagi ya.";
}
