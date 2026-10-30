import test from "node:test";
import assert from "node:assert/strict";
import { processMessage } from "../src/processMessage.js";
import { PROCESSING_STATUS, TASK_STATUS, PAYMENT_STATUS } from "../src/constants.js";

function createMockRepository() {
    const tasks = [
        {
            rowNumber: 2,
            id: "T1",
            clientPhone: "6285869199064",
            taskTitle: "Judul Skripsi",
            createdAt: "29-10-2026",
            deadline: "04-11-2026",
            price: 300000,
            paid: 150000,
            balance: 150000,
            status: TASK_STATUS.PROSES,
            paymentStatus: PAYMENT_STATUS.DP,
            pic: "Rian",
            notes: ""
        },
        {
            rowNumber: 3,
            id: "T2",
            clientPhone: "6281383429831",
            taskTitle: "Metopen",
            createdAt: "29-10-2026",
            deadline: "-",
            price: 200000,
            paid: 200000,
            balance: 0,
            status: TASK_STATUS.SELESAI,
            paymentStatus: PAYMENT_STATUS.LUNAS,
            pic: "-",
            notes: ""
        }
    ];

    return {
        tasks,
        getAllTasks: async () => [...tasks],
        getActiveTasks: async () => tasks.filter((t) => t.status !== TASK_STATUS.SELESAI),
        findTaskById: async (id) => tasks.find((t) => t.id.toLowerCase() === id.toLowerCase()) || null,
        addTask: async (data) => {
            const newTask = {
                id: `T${tasks.length + 1}`,
                clientPhone: data.clientPhone,
                taskTitle: data.taskTitle,
                createdAt: "29-10-2026",
                deadline: data.deadline,
                price: Number(data.price),
                paid: Number(data.paid),
                balance: Number(data.price) - Number(data.paid),
                status: TASK_STATUS.PROSES,
                paymentStatus: Number(data.paid) >= Number(data.price) ? PAYMENT_STATUS.LUNAS : (Number(data.paid) > 0 ? PAYMENT_STATUS.DP : PAYMENT_STATUS.BELUM_BAYAR),
                pic: data.pic || "-",
                notes: data.notes || ""
            };
            tasks.push(newTask);
            return newTask;
        },
        addPayment: async (id, amount) => {
            const task = tasks.find((t) => t.id.toLowerCase() === id.toLowerCase());
            const num = Number(amount);
            task.paid += num;
            task.balance = Math.max(0, task.price - task.paid);
            task.paymentStatus = task.paid >= task.price ? PAYMENT_STATUS.LUNAS : PAYMENT_STATUS.DP;
            return { task, addedAmount: num };
        },
        updateStatus: async (id, newStatus, notes = null) => {
            const task = tasks.find((t) => t.id.toLowerCase() === id.toLowerCase());
            task.status = newStatus;
            if (notes !== null) task.notes = notes;
            return task;
        },
        updatePic: async (id, pic) => {
            const task = tasks.find((t) => t.id.toLowerCase() === id.toLowerCase());
            task.pic = pic;
            return task;
        },
        updateNotes: async (id, notes) => {
            const task = tasks.find((t) => t.id.toLowerCase() === id.toLowerCase());
            task.notes = notes;
            return task;
        }
    };
}

function createBaseMessage(text, isGroup = false) {
    return {
        messageId: "MSG_001",
        chatId: isGroup ? "120363000000000000@g.us" : "6281234567890@s.whatsapp.net",
        groupId: isGroup ? "120363000000000000@g.us" : null,
        isGroup,
        senderName: "Budi",
        senderPhone: "6281234567890",
        messageText: text,
        mentionedJids: [],
        receivedAt: "2026-10-29T21:00:00+07:00",
        rawMessage: {}
    };
}

test("perintah /list menampilkan daftar tugas yang masih aktif", async () => {
    const taskRepository = createMockRepository();
    let replyText = "";
    const sendReply = async (_, text) => { replyText = text; };

    const status = await processMessage(createBaseMessage("/list"), {
        taskRepository,
        sendReply
    });

    assert.equal(status, PROCESSING_STATUS.PROCESSED);
    assert.match(replyText, /LIST TUGAS/);
    assert.match(replyText, /T1 \| 6285869199064 \| Judul Skripsi \| 04-11-2026/);
    // T2 yang sudah selesai tidak boleh muncul di list aktif
    assert.doesNotMatch(replyText, /T2 \|/);
});

test("perintah /tambah menambahkan tugas baru dan membalas dengan ringkasan", async () => {
    const taskRepository = createMockRepository();
    let replyText = "";
    const sendReply = async (_, text) => { replyText = text; };

    const status = await processMessage(
        createBaseMessage("/tambah 081234567890 | Makalah Bisnis | 31-10-2026 | 250000 | 100000 | Rian"),
        { taskRepository, sendReply }
    );

    assert.equal(status, PROCESSING_STATUS.PROCESSED);
    assert.match(replyText, /TUGAS BERHASIL DITAMBAHKAN/);
    assert.match(replyText, /Makalah Bisnis/);
    assert.match(replyText, /Rp 250\.000/);
    assert.match(replyText, /Rp 100\.000/);
});

test("perintah /bayar mencatat penambahan pembayaran", async () => {
    const taskRepository = createMockRepository();
    let replyText = "";
    const sendReply = async (_, text) => { replyText = text; };

    const status = await processMessage(
        createBaseMessage("/bayar T1 150000"),
        { taskRepository, sendReply }
    );

    assert.equal(status, PROCESSING_STATUS.PROCESSED);
    assert.match(replyText, /PEMBAYARAN DITERIMA/);
    assert.match(replyText, /LUNAS/);
});

test("perintah /selesai menandai tugas selesai", async () => {
    const taskRepository = createMockRepository();
    let replyText = "";
    const sendReply = async (_, text) => { replyText = text; };

    const status = await processMessage(
        createBaseMessage("/selesai T1"),
        { taskRepository, sendReply }
    );

    assert.equal(status, PROCESSING_STATUS.PROCESSED);
    assert.match(replyText, /TUGAS SELESAI/);
    assert.equal(taskRepository.tasks[0].status, TASK_STATUS.SELESAI);
});

test("perintah /revisi mengubah status dan menambahkan catatan revisi", async () => {
    const taskRepository = createMockRepository();
    let replyText = "";
    const sendReply = async (_, text) => { replyText = text; };

    const status = await processMessage(
        createBaseMessage("/revisi T1 Bab 2 sitasi kurang"),
        { taskRepository, sendReply }
    );

    assert.equal(status, PROCESSING_STATUS.PROCESSED);
    assert.match(replyText, /STATUS REVISI/);
    assert.match(replyText, /Bab 2 sitasi kurang/);
    assert.equal(taskRepository.tasks[0].status, TASK_STATUS.REVISI);
});

test("perintah /detail menampilkan rincian lengkap tugas", async () => {
    const taskRepository = createMockRepository();
    let replyText = "";
    const sendReply = async (_, text) => { replyText = text; };

    const status = await processMessage(
        createBaseMessage("/detail T1"),
        { taskRepository, sendReply }
    );

    assert.equal(status, PROCESSING_STATUS.PROCESSED);
    assert.match(replyText, /DETAIL TUGAS T1/);
    assert.match(replyText, /Judul Skripsi/);
});

test("mengabaikan pesan grup jika tidak diawali slash dan tidak mention bot", async () => {
    const taskRepository = createMockRepository();
    let replySent = false;
    const sendReply = async () => { replySent = true; };

    const status = await processMessage(
        createBaseMessage("halo guys tugasnya gimana", true),
        { taskRepository, sendReply }
    );

    assert.equal(status, PROCESSING_STATUS.IGNORED);
    assert.equal(replySent, false);
});
