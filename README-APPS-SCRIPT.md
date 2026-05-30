# Panduan Integrasi Google Apps Script

## 🎯 Tujuan
Menghubungkan Dashboard Monitoring dengan Google Sheets agar data yang diedit di web bisa tersimpan secara **permanen** ke spreadsheet.

---

## 📋 Langkah-langkah Setup

### 1. Buka Google Apps Script Editor
1. Buka spreadsheet Anda: `https://docs.google.com/spreadsheets/d/1ASHtHbSeGP0NLuaFPKf_cN6ccsddyOCkvwsGy4Ns3pA/`
2. Klik menu **Extensions** (Ekstensi) → **Apps Script**
3. Hapus semua kode yang ada di editor

### 2. Copy-Paste Kode Apps Script
1. Buka file `apps-script.gs` di project ini
2. **Copy semua isi** file tersebut
3. **Paste** ke editor Apps Script
4. Klik ikon **Save** (💾) atau tekan `Ctrl+S`

### 3. Deploy sebagai Web App
1. Klik tombol **Deploy** di pojok kanan atas
2. Pilih **New deployment**
3. Klik ikon ⚙️ (Select type) → pilih **Web app**
4. Isi konfigurasi:
   - **Description**: `Monitoring Dashboard API`
   - **Execute as**: `Me (email Anda)`
   - **Who has access**: `Anyone` ⚠️ (WAJIB)
5. Klik **Deploy**
6. **Authorize Access** → pilih akun Google Anda → Advanced → Go to ... (unsafe) → Allow

### 4. Salin URL Web App
Setelah deploy berhasil, Anda akan melihat URL seperti ini:
```
https://script.google.com/macros/s/AKfycbx...xxxxxxxxxxxx/exec
```
**Salin URL ini!**

### 5. Konfigurasi di Dashboard
1. Buka file `src/api.ts` di project ini
2. Cari baris:
   ```typescript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```
3. Ganti URL tersebut dengan URL yang Anda salin tadi
4. Build ulang project: `npm run build`

---

## ✅ Verifikasi

### Test Endpoint (Opsional)
Buka browser dan akses:
```
https://script.google.com/macros/s/YOUR_ID/exec?action=data_masuk
```
Jika berhasil, akan muncul JSON berisi data dari sheet "Data Masuk".

### Test di Dashboard
1. Login ke dashboard
2. Klik **Konfirmasi** pada salah satu siswa
3. Isi data dan klik **Simpan**
4. Seharusnya muncul notifikasi **"✓ Data berhasil disimpan ke Spreadsheet"** (hijau)
5. Buka Google Sheets Anda, data seharusnya sudah terupdate!

---

## 🔍 Indikator Status

Dashboard memiliki **indicator** di header:
- 🟢 **Apps Script: Connected** (Hijau) = URL sudah dikonfigurasi, data tersimpan permanen
- 🟡 **Mode: Local Only** (Kuning) = URL belum dikonfigurasi, data hanya tersimpan di browser

---

## 📡 Endpoint yang Tersedia

### GET - Fetch Data
| Endpoint | Fungsi |
|----------|--------|
| `?action=data_masuk` | Ambil semua data dari sheet "Data Masuk" |
| `?action=validasi` | Ambil data validasi (SMPN, SMAN, SMKN, Tempat, Konsultan) |

### POST - Update Data
```json
{
  "action": "update",
  "timestamp": "30/5/2026, 17:10:48",
  "namaSiswa": "Nizam",
  "tanggalKonsultasi": "2026-06-01",
  "waktuKonsultasi": "10:00 - 12:00",
  "konsultan": "WICAKSONO",
  "status": "Terkonfirmasi"
}
```

---

## 🐛 Troubleshooting

### Data tidak tersimpan ke Sheets
- Pastikan URL Apps Script sudah benar di `src/api.ts`
- Pastikan akses Web App diset ke **"Anyone"**
- Cek console browser (F12) untuk error message

### Error "Script function not found"
- Pastikan kode Apps Script sudah di-save
- Coba re-deploy dengan **New deployment** (bukan update)

### CORS Error
- Ini normal, dashboard sudah menggunakan `mode: 'no-cors'`
- Data tetap terkirim meski ada warning di console

---

## 📁 Struktur File

```
├── apps-script.gs          # Kode Google Apps Script (copy ke Apps Script Editor)
├── src/
│   ├── api.ts             # API calls & konfigurasi URL
│   ├── App.tsx            # Dashboard utama
│   └── types.ts           # TypeScript interfaces
└── README-APPS-SCRIPT.md  # File ini
```

---

## 🔒 Keamanan

- Password login disimpan di **localStorage** (client-side only)
- Data sensitif sebaiknya tidak disimpan di frontend
- Untuk produksi, pertimbangkan menggunakan **Google OAuth** untuk autentikasi
- URL Apps Script bisa diakses siapa saja yang punya link - pastikan tidak disebarkan

---

## 📞 Dukungan

Jika mengalami kendala:
1. Pastikan Spreadsheet ID benar: `1ASHtHbSeGP0NLuaFPKf_cN6ccsddyOCkvwsGy4Ns3pA`
2. Pastikan nama sheet **"Data Masuk"** (case-sensitive)
3. Pastikan kolom E di sheet **"Validasi"** berisi daftar konsultan
