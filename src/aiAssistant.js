import { GoogleGenAI, Type } from "@google/genai";
import { normalizeTaskId, getTodayDateString } from "./googleSheetsRepository.js";
import { logger } from "./logger.js";

const MAX_STEPS = 5;
const MAX_SESSION_MESSAGES = 16; // Menyimpan hingga 8 percakapan tanya-jawab terakhir

const SYSTEM_INSTRUCTION = [
    "Kamu adalah asisten AI resmi, cerdas, dan serba bisa untuk layanan Joki Tugas di WhatsApp.",
    "Gaya bahasamu asyik, santun, ramah, profesional, dan selalu solutif.",
    "",
    "KEMAMPUAN UTAMA:",
    "1. Memiliki Ingatan Percakapan (Memory):",
    "   - Kamu mengingat percakapan sebelumnya dengan pengguna dalam sesi ini.",
    "   - Kamu bisa diajak ngobrol nyambung terus-menerus selayaknya ChatGPT / Gemini asli.",
    "2. Membantu Administrasi Joki Tugas:",
    "   - Jika pengguna bertanya tentang data tugas, deadline, status pembayaran, PIC, atau rekap omset, gunakan fungsi 'cariDataTugas'.",
    "   - Jika pengguna meminta memasukkan/menambahkan tugas ke list atau spreadsheet (baik 1 tugas maupun banyak tugas sekaligus), gunakan fungsi 'tambahTugasBaru'.",
    "   - Jika pengguna bertanya soal tugas hari ini, besok, minggu ini, atau tanggal tertentu, gunakan 'cariDataTugas' dengan parameter deadlineTanggal, deadlineDari, atau deadlineSampai.",
    "   - Semua tanggal deadline di spreadsheet menggunakan format DD-MM-YYYY (contoh: 30-10-2026). Jam disimpan terpisah di kolom Jam dengan format HH:mm (contoh: 20:00). Jam bersifat opsional.",
    "   - Jika pengguna bilang 'besok', 'lusa', 'minggu ini', 'bulan depan', dsb, hitung tanggalnya dari tanggal hari ini yang diberikan di bawah.",
    "3. Membantu Pengerjaan & Konsultasi Tugas:",
    "   - Kamu BISA dan SANGAT TERBUKA membantu tugas apapun: merapikan format teks, mencarikan referensi/ide judul, membuat outline makalah/skripsi, menerjemahkan, merangkum materi, dan mengedit teks.",
    "4. Percakapan Umum & Chatting:",
    "   - Jawab obrolan santai, pertanyaan umum, maupun konsultasi dengan cerdas dan bersahabat.",
    "",
    "Format mata uang selalu gunakan Rupiah (Rp). Jika pengguna ingin melihat perintah bot, arahkan memakai /help."
].join("\n");

// Deklarasi Tool Pencarian Data Tugas
const SEARCH_DECLARATION = {
    name: "cariDataTugas",
    description: "Cari, saring, dan rekap data tugas joki dari spreadsheet, seperti cek deadline, status pengerjaan, status pembayaran, atau filter per PIC. Bisa juga filter berdasarkan tanggal deadline.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            idTugas: { type: Type.STRING, description: "ID tugas tertentu, contoh T1 atau T014" },
            noWa: { type: Type.STRING, description: "Nomor WhatsApp klien" },
            statusTugas: { type: Type.STRING, description: "Filter status tugas: Antre, Proses, Revisi, Selesai, Batal" },
            statusBayar: { type: Type.STRING, description: "Filter status pembayaran: Belum Bayar, DP, Lunas" },
            pic: { type: Type.STRING, description: "Nama PIC atau joki yang mengerjakan" },
            keyword: { type: Type.STRING, description: "Kata kunci pada jenis/nama tugas atau catatan" },
            hanyaAktif: { type: Type.BOOLEAN, description: "True jika hanya mencari tugas yang masih aktif (belum selesai), default true" },
            deadlineTanggal: { type: Type.STRING, description: "Filter deadline tepat pada tanggal tertentu, format DD-MM-YYYY. Contoh: 30-10-2026" },
            deadlineDari: { type: Type.STRING, description: "Filter deadline dari tanggal ini (inklusif), format DD-MM-YYYY. Contoh: 29-10-2026" },
            deadlineSampai: { type: Type.STRING, description: "Filter deadline sampai tanggal ini (inklusif), format DD-MM-YYYY. Contoh: 31-10-2026" }
        }
    }
};

// Deklarasi Tool Tambah Tugas Baru Otomatis lewat AI
const ADD_TASK_DECLARATION = {
    name: "tambahTugasBaru",
    description: "Tambahkan satu atau beberapa data tugas baru ke Google Sheets ketika pengguna meminta memasukkan data ke list",
    parameters: {
        type: Type.OBJECT,
        properties: {
            daftarTugas: {
                type: Type.ARRAY,
                description: "List data tugas yang akan dimasukkan",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        clientPhone: { type: Type.STRING, description: "Nomor WhatsApp klien, contoh 081234567890" },
                        taskTitle: { type: Type.STRING, description: "Nama atau jenis tugas" },
                        deadline: { type: Type.STRING, description: "Deadline tanggal, format DD-MM-YYYY. Contoh: 04-11-2026 atau -" },
                        jam: { type: Type.STRING, description: "Jam deadline jika disebutkan, format HH:mm. Contoh: 20:00 atau 08:30. Kosongkan jika tidak ada jam." },
                        price: { type: Type.NUMBER, description: "Harga total tugas jika ada, default 0" },
                        paid: { type: Type.NUMBER, description: "Nominal yang sudah dibayar/DP jika ada, default 0" },
                        pic: { type: Type.STRING, description: "Nama PIC jika ada, default -" },
                        notes: { type: Type.STRING, description: "Catatan tambahan jika ada" }
                    },
                    required: ["clientPhone", "taskTitle"]
                }
            }
        },
        required: ["daftarTugas"]
    }
};

// Parse tanggal DD-MM-YYYY atau DD-MM-YYYY HH:mm ke Date object (hanya ambil tanggal, abaikan jam untuk filter)
function parseDateDMY(dateStr) {
    if (!dateStr || dateStr === "-") return null;
    const match = String(dateStr).match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (!match) return null;
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
}

// Filter tugas berdasarkan parameter
function filterTasks(tasks, filters = {}) {
    let result = [...tasks];

    if (filters.hanyaAktif !== false) {
        result = result.filter((t) => {
            const st = (t.status || "").toLowerCase();
            return st !== "selesai" && st !== "batal";
        });
    }

    if (filters.idTugas) {
        const targetId = normalizeTaskId(filters.idTugas);
        result = result.filter((t) => normalizeTaskId(t.id) === targetId);
    }

    if (filters.noWa) {
        const cleanNo = filters.noWa.replace(/\D/g, "");
        result = result.filter((t) => (t.clientPhone || "").replace(/\D/g, "").includes(cleanNo));
    }

    if (filters.statusTugas) {
        result = result.filter((t) => (t.status || "").toLowerCase() === filters.statusTugas.toLowerCase());
    }

    if (filters.statusBayar) {
        result = result.filter((t) => (t.paymentStatus || "").toLowerCase() === filters.statusBayar.toLowerCase());
    }

    if (filters.pic) {
        result = result.filter((t) => (t.pic || "").toLowerCase().includes(filters.pic.toLowerCase()));
    }

    if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        result = result.filter((t) =>
            (t.taskTitle || "").toLowerCase().includes(kw) || (t.notes || "").toLowerCase().includes(kw)
        );
    }

    // Filter berdasarkan deadline tepat pada tanggal tertentu
    if (filters.deadlineTanggal) {
        const target = parseDateDMY(filters.deadlineTanggal);
        if (target) {
            result = result.filter((t) => {
                const dl = parseDateDMY(t.deadline);
                return dl && dl.getTime() === target.getTime();
            });
        }
    }

    // Filter berdasarkan rentang deadline (dari - sampai)
    if (filters.deadlineDari) {
        const dari = parseDateDMY(filters.deadlineDari);
        if (dari) {
            result = result.filter((t) => {
                const dl = parseDateDMY(t.deadline);
                return dl && dl >= dari;
            });
        }
    }

    if (filters.deadlineSampai) {
        const sampai = parseDateDMY(filters.deadlineSampai);
        if (sampai) {
            result = result.filter((t) => {
                const dl = parseDateDMY(t.deadline);
                return dl && dl <= sampai;
            });
        }
    }

    const totalHarga = result.reduce((sum, t) => sum + (t.price || 0), 0);
    const totalBayar = result.reduce((sum, t) => sum + (t.paid || 0), 0);
    const totalSisa = result.reduce((sum, t) => sum + (t.balance || 0), 0);

    return {
        jumlahTugas: result.length,
        totalHarga,
        totalBayar,
        totalSisaTagihan: totalSisa,
        daftarTugas: result.map((t) => ({
            id: t.id,
            klien: t.clientPhone,
            tugas: t.taskTitle,
            tglMasuk: t.createdAt,
            deadline: t.deadline,
            jam: t.jam || "",
            harga: t.price,
            terbayar: t.paid,
            sisa: t.balance,
            statusTugas: t.status,
            statusBayar: t.paymentStatus,
            pic: t.pic,
            catatan: t.notes
        }))
    };
}

const FALLBACK_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.5-flash"
];

// Panggil model dengan mekanisme fallback otomatis jika server Google 503/sibuk
async function generateWithFallback(ai, contents, config, primaryModel) {
    const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter((m) => m !== primaryModel)];
    let lastError = null;

    for (const model of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                return await ai.models.generateContent({ model, contents, config });
            } catch (err) {
                lastError = err;
                const msg = err.message || "";
                if (msg.includes("503") || msg.includes("429") || msg.includes("UNAVAILABLE")) {
                    logger.warn(`Model ${model} sibuk (503/429), mencoba ulang...`);
                    await new Promise((r) => setTimeout(r, 1500));
                    continue;
                }
                break;
            }
        }
    }
    throw lastError;
}

// Memori percakapan aktif per chat/user
const chatSessions = new Map();

export function clearChatSession(sessionId) {
    chatSessions.delete(sessionId);
}

// Asisten AI Gemini yang serba bisa dengan memori percakapan
export function createAiAssistant({ apiKey, model = "gemini-3.1-flash-lite", taskRepository }) {
    const ai = new GoogleGenAI({ apiKey });

    async function ask(question, options = {}) {
        const opts = typeof options === "string" ? { receivedAt: options } : options;
        const sessionId = opts.sessionId || "default";
        const receivedAt = opts.receivedAt || new Date().toISOString();

        // Fitur reset percakapan
        if (["/reset", "/newchat", "/hapuschat"].includes(question.toLowerCase().trim())) {
            clearChatSession(sessionId);
            return "🔄 Obrolan kita telah di-reset! Kita mulai percakapan baru. Ada yang bisa saya bantu?";
        }

        if (!chatSessions.has(sessionId)) {
            chatSessions.set(sessionId, []);
        }
        const sessionHistory = chatSessions.get(sessionId);

        // Gabungkan riwayat chat sebelumnya dengan pesan baru
        const contents = [
            ...sessionHistory,
            { role: "user", parts: [{ text: question }] }
        ];

        const config = {
            systemInstruction: `${SYSTEM_INSTRUCTION}\nHari ini tanggal ${getTodayDateString(receivedAt)} (format DD-MM-YYYY).`,
            tools: [{ functionDeclarations: [SEARCH_DECLARATION, ADD_TASK_DECLARATION] }]
        };

        let cachedTasks = null;
        let finalText = null;

        for (let step = 0; step < MAX_STEPS; step++) {
            const response = await generateWithFallback(ai, contents, config, model);
            const calls = response.functionCalls ?? [];

            if (calls.length === 0) {
                finalText = response.text?.trim() || null;
                break;
            }

            const parts = [];

            for (const { name, args } of calls) {
                if (name === "cariDataTugas") {
                    cachedTasks ??= await taskRepository.getAllTasks();
                    const filterResult = filterTasks(cachedTasks, args ?? {});
                    parts.push({ functionResponse: { name, response: filterResult } });
                } else if (name === "tambahTugasBaru") {
                    const list = args?.daftarTugas ?? [];
                    const createdList = [];
                    for (const item of list) {
                        const res = await taskRepository.addTask({
                            clientPhone: item.clientPhone,
                            taskTitle: item.taskTitle,
                            deadline: item.deadline || "-",
                            jam: item.jam || "",
                            price: item.price || 0,
                            paid: item.paid || 0,
                            pic: item.pic || "-",
                            notes: item.notes || "",
                            receivedAt
                        });
                        createdList.push(res);
                    }
                    cachedTasks = null;
                    parts.push({
                        functionResponse: {
                            name,
                            response: {
                                sukses: true,
                                jumlahDimasukkan: createdList.length,
                                tugas: createdList
                            }
                        }
                    });
                }
            }

            contents.push(response.candidates[0].content);
            contents.push({ role: "user", parts });
        }

        // Simpan ke memori sesi jika ada jawaban dari AI
        if (finalText) {
            sessionHistory.push({ role: "user", parts: [{ text: question }] });
            sessionHistory.push({ role: "model", parts: [{ text: finalText }] });

            if (sessionHistory.length > MAX_SESSION_MESSAGES) {
                sessionHistory.splice(0, sessionHistory.length - MAX_SESSION_MESSAGES);
            }
        }

        return finalText;
    }

    return { ask, clearChatSession };
}
