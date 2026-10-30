import { auth, sheets } from "@googleapis/sheets";
import { PAYMENT_STATUS, TASK_STATUS } from "./constants.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// Rapikan nomor WhatsApp ke awalan 62 atau 08
export const normalizePhone = (phone) => String(phone ?? "").replace(/\D/g, "").replace(/^0/, "62");

// Format angka ke format rupiah (contoh: 250000 -> 250.000)
export function formatRupiah(num) {
    const val = Number(num) || 0;
    return val.toLocaleString("id-ID");
}

// Parsing string angka ke number murni
export function parseNumber(val) {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const digitsOnly = String(val).replace(/\D/g, "");
    return Number(digitsOnly) || 0;
}

// Standarisasi ID Tugas (contoh: 't1', 'T01', '1' -> 'T1')
export function normalizeTaskId(input) {
    if (!input) return "";
    const trimmed = String(input).trim().toUpperCase();
    if (/^\d+$/.test(trimmed)) {
        return `T${parseInt(trimmed, 10)}`;
    }
    const match = trimmed.match(/^T0*(\d+)$/);
    if (match) {
        return `T${parseInt(match[1], 10)}`;
    }
    return trimmed;
}

// Format tanggal hari ini DD-MM-YYYY
export function getTodayDateString(receivedAt = null) {
    const date = receivedAt ? new Date(receivedAt) : new Date();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Repository Google Sheets untuk Data Joki Tugas
export function createTaskRepository({ spreadsheetId, tasksSheetName = "Sheet1", googleCredentials }) {
    const authOptions = { scopes: [SHEETS_SCOPE] };
    if (googleCredentials) {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        authOptions.credentials = googleCredentials;
    }
    const sheetsClient = sheets({ version: "v4", auth: new auth.GoogleAuth(authOptions) });

    const sheetRange = (cells) => `'${tasksSheetName}'!${cells}`;

    // Ambil semua data tugas dari sheet baris 2 ke bawah
    // Kolom: A=ID | B=NoWA | C=Tugas | D=TglMasuk | E=Deadline | F=Jam | G=Harga | H=TotalBayar | I=Sisa | J=Status | K=StatusBayar | L=PIC | M=Catatan
    async function getAllTasks() {
        const response = await sheetsClient.spreadsheets.values.get({
            spreadsheetId,
            range: sheetRange("A2:M")
        });
        const rows = response.data.values ?? [];

        return rows
            .map((row, index) => {
                const id = row[0]?.trim() || "";
                if (!id) return null;

                const price = parseNumber(row[6]);
                const paid = parseNumber(row[7]);
                const balance = row[8] !== undefined && row[8] !== "" ? parseNumber(row[8]) : Math.max(0, price - paid);

                return {
                    rowNumber: index + 2,
                    id,
                    clientPhone: row[1]?.trim() || "",
                    taskTitle: row[2]?.trim() || "",
                    createdAt: row[3]?.trim() || "",
                    deadline: row[4]?.trim() || "-",
                    jam: row[5]?.trim() || "",
                    price,
                    paid,
                    balance,
                    status: row[9]?.trim() || TASK_STATUS.PROSES,
                    paymentStatus: row[10]?.trim() || PAYMENT_STATUS.BELUM_BAYAR,
                    pic: row[11]?.trim() || "-",
                    notes: row[12]?.trim() || ""
                };
            })
            .filter(Boolean);
    }

    // Ambil tugas yang masih aktif (bukan Selesai atau Batal)
    async function getActiveTasks() {
        const tasks = await getAllTasks();
        return tasks.filter((t) => {
            const st = (t.status || "").toLowerCase();
            return st !== TASK_STATUS.SELESAI.toLowerCase() && st !== TASK_STATUS.BATAL.toLowerCase();
        });
    }

    // Cari satu tugas berdasarkan ID
    async function findTaskById(idInput) {
        const tasks = await getAllTasks();
        const targetId = normalizeTaskId(idInput);
        return tasks.find((t) => normalizeTaskId(t.id) === targetId) || null;
    }

    // Tambah tugas baru ke Google Sheets
    async function addTask({ clientPhone, taskTitle, deadline, jam = "", price, paid = 0, pic = "-", notes = "", receivedAt }) {
        const tasks = await getAllTasks();

        // Cari nomor ID tugas berikutnya (contoh: max T5 -> T6)
        let maxNumber = 0;
        for (const t of tasks) {
            const match = t.id.match(/^T0*(\d+)$/i);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumber) maxNumber = num;
            }
        }
        const newId = `T${maxNumber + 1}`;

        const numPrice = parseNumber(price);
        const numPaid = parseNumber(paid);
        const balance = Math.max(0, numPrice - numPaid);
        const createdAt = getTodayDateString(receivedAt);
        const paymentStatus = numPaid >= numPrice && numPrice > 0 ? PAYMENT_STATUS.LUNAS : (numPaid > 0 ? PAYMENT_STATUS.DP : PAYMENT_STATUS.BELUM_BAYAR);
        const status = TASK_STATUS.PROSES;
        const picClean = pic?.trim() || "-";
        const notesClean = notes?.trim() || "";
        const cleanDeadline = deadline?.trim() || "-";
        const cleanJam = jam?.trim() || "";

        await sheetsClient.spreadsheets.values.append({
            spreadsheetId,
            range: sheetRange("A:M"),
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[
                    newId,
                    clientPhone,
                    taskTitle,
                    createdAt,
                    cleanDeadline,
                    cleanJam,
                    numPrice,
                    numPaid,
                    balance,
                    status,
                    paymentStatus,
                    picClean,
                    notesClean
                ]]
            }
        });

        return {
            id: newId,
            clientPhone,
            taskTitle,
            createdAt,
            deadline: cleanDeadline,
            jam: cleanJam,
            price: numPrice,
            paid: numPaid,
            balance,
            status,
            paymentStatus,
            pic: picClean,
            notes: notesClean
        };
    }

    // Catat pembayaran (menambahkan ke Total Bayar)
    async function addPayment(idInput, amount) {
        const task = await findTaskById(idInput);
        if (!task) {
            throw new Error(`Tugas dengan ID ${idInput} tidak ditemukan.`);
        }

        const addedAmount = parseNumber(amount);
        const newPaid = task.paid + addedAmount;
        const newBalance = Math.max(0, task.price - newPaid);
        const newPaymentStatus = newPaid >= task.price && task.price > 0 ? PAYMENT_STATUS.LUNAS : (newPaid > 0 ? PAYMENT_STATUS.DP : PAYMENT_STATUS.BELUM_BAYAR);

        await sheetsClient.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: "USER_ENTERED",
                data: [
                    { range: sheetRange(`H${task.rowNumber}`), values: [[newPaid]] },
                    { range: sheetRange(`I${task.rowNumber}`), values: [[newBalance]] },
                    { range: sheetRange(`K${task.rowNumber}`), values: [[newPaymentStatus]] }
                ]
            }
        });

        task.paid = newPaid;
        task.balance = newBalance;
        task.paymentStatus = newPaymentStatus;

        return { task, addedAmount };
    }

    // Update status pengerjaan (misal: Selesai, Revisi, Proses)
    async function updateStatus(idInput, newStatus, notes = null) {
        const task = await findTaskById(idInput);
        if (!task) {
            throw new Error(`Tugas dengan ID ${idInput} tidak ditemukan.`);
        }

        const data = [{ range: sheetRange(`J${task.rowNumber}`), values: [[newStatus]] }];

        if (notes !== null) {
            data.push({ range: sheetRange(`M${task.rowNumber}`), values: [[notes]] });
            task.notes = notes;
        }

        await sheetsClient.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: "USER_ENTERED",
                data
            }
        });

        task.status = newStatus;
        return task;
    }

    // Update PIC yang mengerjakan
    async function updatePic(idInput, newPic) {
        const task = await findTaskById(idInput);
        if (!task) {
            throw new Error(`Tugas dengan ID ${idInput} tidak ditemukan.`);
        }

        const cleanPic = newPic?.trim() || "-";
        await sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range: sheetRange(`L${task.rowNumber}`),
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[cleanPic]]
            }
        });

        task.pic = cleanPic;
        return task;
    }

    // Update catatan tambahan / link drive
    async function updateNotes(idInput, newNotes) {
        const task = await findTaskById(idInput);
        if (!task) {
            throw new Error(`Tugas dengan ID ${idInput} tidak ditemukan.`);
        }

        const cleanNotes = newNotes?.trim() || "";
        await sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range: sheetRange(`M${task.rowNumber}`),
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[cleanNotes]]
            }
        });

        task.notes = cleanNotes;
        return task;
    }

    // Hapus tugas dari spreadsheet (menghapus seluruh baris)
    async function deleteTask(idInput) {
        const task = await findTaskById(idInput);
        if (!task) {
            throw new Error(`Tugas dengan ID ${idInput} tidak ditemukan.`);
        }

        // Dapatkan sheetId (numeric) untuk request deleteDimension
        const spreadsheet = await sheetsClient.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find(
            (s) => s.properties.title === tasksSheetName
        );
        if (!sheet) {
            throw new Error(`Sheet "${tasksSheetName}" tidak ditemukan.`);
        }
        const sheetId = sheet.properties.sheetId;

        // Hapus baris (rowNumber adalah 1-indexed, API deleteDimension pakai 0-indexed)
        await sheetsClient.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId,
                                dimension: "ROWS",
                                startIndex: task.rowNumber - 1,
                                endIndex: task.rowNumber
                            }
                        }
                    }
                ]
            }
        });

        return task;
    }

    return {
        getAllTasks,
        getActiveTasks,
        findTaskById,
        addTask,
        addPayment,
        updateStatus,
        updatePic,
        updateNotes,
        deleteTask
    };
}
