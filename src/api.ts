
import { SpreadsheetRow } from './types';

// URL Web App Google Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwmt21box6T9w0OeO8FifXzs9H-yt3qtoEBAt1HCrh5gL7KYE6RO6QbHI3owzW9wgY6/exec';
const USE_APPSCRIPT = true;

// Fallback: Google Sheets JSON API (read-only)
const SHEET_ID = '1ASHtHbSeGP0NLuaFPKf_cN6ccsddyOCkvwsGy4Ns3pA';

/**
 * Fetch data dari sheet "Data Masuk" menggunakan Apps Script
 * Jika Apps Script belum di-deploy, fallback ke gviz API
 */
export async function fetchSpreadsheetData(): Promise<SpreadsheetRow[]> {
  if (USE_APPSCRIPT) {
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?action=data_masuk&t=${Date.now()}`);
      const objects = await response.json();
      return parseDataMasukObjects(objects);
    } catch (error) {
      console.error('Apps Script gagal, mencoba gviz...', error);
    }
  }
  return fetchViaGviz();
}

/**
 * Parse response dari Apps Script (array of objects dengan nama header sebagai key)
 */
function parseDataMasukObjects(objects: any[]): SpreadsheetRow[] {
  return objects.map((obj: any, i: number) => {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const found = Object.keys(obj).find(k => k.toLowerCase().replace(/\s+/g, '').includes(key.toLowerCase().replace(/\s+/g, '')));
        if (found && obj[found] !== undefined && obj[found] !== null && obj[found] !== '') {
          return String(obj[found]);
        }
      }
      return '';
    };

    return {
      rowId: String(obj.rowId || (i + 2)),
      timestamp: get('Timestamp'),
      namaSiswa: get('Nama Siswa'),
      asalSekolah: get('Asal Sekolah'),
      noWhatsappSiswa: get('No.Whatsapp Siswa', 'Whatsapp Siswa'),
      namaOrangTua: get('Nama Orang Tua', 'Wali'),
      noWhatsappOrtu: get('No.Whatsapp Ortu', 'Whatsapp Ortu'),
      alamatRumah: get('Alamat Rumah'),
      jalurMasuk: get('Jalur Masuk'),
      sekolahTarget: get('Sekolah Target'),
      tempatKonsultasi: get('Tempat Konsultasi'),
      tanggalKonsultasi: get('Tanggal Konsultasi'),
      waktuKonsultasi: get('Waktu Konsultasi'),
      konsultan: get('Konsultan'),
      status: get('Status') || (get('Tanggal Konsultasi') && get('Waktu Konsultasi') && get('Konsultan') ? 'Terkonfirmasi' : 'Belum Dikonfirmasi'),
    };
  });
}

/**
 * Fallback: Fetch via Google Sheets gviz API
 */
async function fetchViaGviz(): Promise<SpreadsheetRow[]> {
  const SHEET_NAME = 'Data Masuk';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    const jsonData = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const rows = jsonData.table.rows;
    
    return rows.map((row: any, i: number) => {
      const getVal = (idx: number) => (idx < 0 || !row.c[idx]) ? '' : (row.c[idx].v ?? '');
      const getFormattedVal = (idx: number) => (idx < 0 || !row.c[idx]) ? '' : (row.c[idx].f ?? row.c[idx].v ?? '');

      return {
        rowId: String(i + 2),
        timestamp: getFormattedVal(0),
        namaSiswa: String(getVal(1) || ''),
        asalSekolah: String(getVal(2) || ''),
        noWhatsappSiswa: String(getFormattedVal(3) || ''),
        namaOrangTua: String(getVal(4) || ''),
        noWhatsappOrtu: String(getFormattedVal(5) || ''),
        alamatRumah: String(getVal(6) || ''),
        jalurMasuk: String(getVal(7) || ''),
        sekolahTarget: String(getVal(8) || ''),
        tempatKonsultasi: String(getVal(9) || ''),
        tanggalKonsultasi: String(getFormattedVal(10) || ''),
        waktuKonsultasi: String(getFormattedVal(11) || ''),
        konsultan: String(getVal(12) || ''),
        status: String(getVal(14) || getVal(13) || 'Pending'), 
      };
    });
  } catch (error) {
    console.error('Error fetching spreadsheet data:', error);
    throw error;
  }
}

/**
 * Fetch daftar Konsultan dari sheet "Validasi" kolom E
 * Karena Apps Script tidak expose konsultan, pakai gviz sebagai fallback
 */
export async function fetchKonsultanOptions(): Promise<string[]> {
  if (USE_APPSCRIPT) {
    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?action=validasi&t=${Date.now()}`);
      const data = await response.json();
      // Jika Apps Script punya field tempat yang bisa di-reuse, atau fallback
      if (Array.isArray(data.konsultan)) return data.konsultan;
    } catch (error) {
      console.error('Apps Script validasi gagal', error);
    }
  }
  
  // Fallback: fetch via gviz API sheet "validasi" kolom E
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=validasi&range=E2:E`;
  try {
    const response = await fetch(url);
    const text = await response.text();
    const jsonData = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const rows = jsonData.table.rows;
    return rows
      .map((row: any) => row.c[0]?.v ?? '')
      .filter((v: string) => String(v).trim() !== '');
  } catch (error) {
    console.error('Error fetching konsultan options:', error);
    return [];
  }
}

/**
 * Kirim data konfirmasi ke Google Sheets via Apps Script (UPDATE baris existing)
 */
export async function saveConfirmation(payload: {
  timestamp: string;
  namaSiswa: string;
  rowId?: string;
  tanggalKonsultasi: string;
  waktuKonsultasi: string;
  konsultan: string;
  status: string;
}): Promise<{ success: boolean; message: string }> {
  if (!USE_APPSCRIPT) {
    return { success: false, message: 'Apps Script URL belum dikonfigurasi. Data hanya disimpan secara lokal.' };
  }

  try {
    // Use GET with query params to avoid CORS preflight issues in some environments.
    const params = new URLSearchParams({ action: 'update' });
    if (payload.rowId) params.set('rowId', payload.rowId);
    if (payload.timestamp) params.set('timestamp', payload.timestamp);
    if (payload.namaSiswa) params.set('namaSiswa', payload.namaSiswa);
    if (payload.tanggalKonsultasi) params.set('tanggalKonsultasi', payload.tanggalKonsultasi);
    if (payload.waktuKonsultasi) params.set('waktuKonsultasi', payload.waktuKonsultasi);
    if (payload.konsultan) params.set('konsultan', payload.konsultan);
    if (payload.status) params.set('status', payload.status);
    params.set('t', String(Date.now()));

    const url = `${APPS_SCRIPT_URL}?${params.toString()}`;
    await fetch(url, { method: 'GET', mode: 'no-cors' });
    return { success: true, message: '✓ Data berhasil disimpan ke Spreadsheet' };
  } catch (err) {
    console.error('Gagal menyimpan:', err);
    return { success: false, message: 'Gagal menyimpan ke Spreadsheet' };
  }
}

/**
 * Cek apakah Apps Script sudah dikonfigurasi
 */
export function isAppScriptConfigured(): boolean {
  return USE_APPSCRIPT;
}
