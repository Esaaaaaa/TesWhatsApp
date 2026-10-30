# WhatsApp Joki Tugas Automation

Bot WhatsApp otomatisasi administrasi dan manajemen joki tugas yang terintegrasi dengan Google Sheets dan didukung oleh Google Gemini AI.

## Fitur Utama

- 📋 **List Tugas Aktif (`/list`)**: Menampilkan daftar tugas yang sedang berjalan secara ringkas.
- ➕ **Tambah Tugas (`/tambah`)**: Menambahkan pesanan joki tugas baru lengkap dengan nomor klien, tenggat waktu, harga, DP, dan PIC.
- 💰 **Catat Pembayaran (`/bayar`)**: Menambahkan pembayaran masuk, otomatis menghitung sisa tagihan dan mengubah status jadi Lunas.
- 🏁 **Update Status**:
  - `/selesai <ID>`: Menandai tugas telah selesai dikerjakan (otomatis diarsipkan).
  - `/revisi <ID> [catatan]`: Menandai status revisi dan menyimpan catatan dosen/klien.
  - `/proses <ID>`: Mengembalikan status tugas ke sedang dikerjakan.
  - `/pic <ID> <Nama>`: Menetapkan atau mengganti penanggung jawab pengerjaan.
  - `/catatan <ID> <Teks>`: Menambahkan link Google Drive materi/hasil atau catatan khusus.
- 📄 **Detail Tugas (`/detail <ID>`)**: Menampilkan informasi lengkap semua kolom tugas.
- 🤖 **Integrasi AI Gemini**:
  - Tanya jawab bebas seputar data tugas (misal: deadline besok, cek sisa tagihan, rekap keuangan, dll) cukup dengan mention bot atau chat pribadi.

---

## Format Kolom Google Sheets

Tabel administrasi tugas di Google Sheets menggunakan format kolom berikut (A sampai L):

| Kolom | Nama Header | Contoh Data |
|---|---|---|
| **A** | `ID Tugas` | `T1`, `T2`, `T14` |
| **B** | `Nomor WA` | `6281234567890` |
| **C** | `Jenis Tugas` | `Makalah Sistem Informasi` |
| **D** | `Tanggal Masuk` | `29-10-2026` |
| **E** | `Deadline` | `31-10-2026` |
| **F** | `Harga (Rp)` | `250000` |
| **G** | `Total Bayar (Rp)` | `100000` |
| **H** | `Sisa Tagihan (Rp)` | `150000` |
| **I** | `Status Tugas` | `Proses` / `Revisi` / `Selesai` |
| **J** | `Status Bayar` | `Belum Bayar` / `DP` / `Lunas` |
| **K** | `PIC` | `Rian` / `-` |
| **L** | `Catatan` | Catatan revisi atau link Google Drive |

---

## Daftar Perintah (Commands)

| Perintah | Format | Contoh |
|---|---|---|
| **Daftar Tugas** | `/list` atau `/tugas` | `/list` |
| **Tambah Tugas** | `/tambah <No WA> \| <Nama Tugas> \| <Deadline> \| <Harga> \| [DP] \| [PIC]` | `/tambah 081234567890 \| Makalah \| 31-10-2026 \| 250000 \| 100000 \| Rian` |
| **Catat Bayar** | `/bayar <ID> <Nominal>` | `/bayar T1 150000` |
| **Selesai** | `/selesai <ID>` | `/selesai T1` |
| **Revisi** | `/revisi <ID> [catatan]` | `/revisi T1 Bab 2 sitasi kurang` |
| **Detail Tugas** | `/detail <ID>` | `/detail T1` |
| **Ganti PIC** | `/pic <ID> <Nama>` | `/pic T1 Budi` |
| **Catatan/Link** | `/catatan <ID> <teks>` | `/catatan T1 link drive: https://...` |
| **Bantuan** | `/help` | `/help` |

---

## Konfigurasi `.env`

Contoh konfigurasi file `.env`:

```env
# ID Spreadsheet Google Sheets Administrasi Joki Tugas
SPREADSHEET_ID=16QV_FcPjah1_N9XkHX6jq8hVYpeA5aCLqgNWWti6MYY

# Nama Tab/Sheet di Google Sheets (default: Sheet1)
TASKS_SHEET_NAME=Sheet1

# Nomor WhatsApp Bot untuk pairing code
WHATSAPP_PHONE_NUMBER=6285173090438

# Path file kredensial Google Service Account
GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json

# API Key Google Gemini (Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-lite-latest

# Opsional: Batasi nomor admin (format 62..., pisahkan dengan koma)
ADMIN_NUMBERS=

# Opsional: Batasi grup WhatsApp tertentu (kosongkan jika untuk semua grup/DM)
ALLOWED_GROUP_IDS=
```

---

## Menjalankan Bot

1. Install dependensi:
   ```bash
   npm install
   ```
2. Jalankan bot:
   ```bash
   npm run dev
   ```
3. Masukkan kode pairing yang muncul di terminal ke aplikasi WhatsApp di HP kamu:
   **WhatsApp > Perangkat tertaut > Tautkan perangkat > Tautkan dengan nomor telepon**.
