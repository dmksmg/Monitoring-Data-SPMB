var SPREADSHEET_ID = '1ASHtHbSeGP0NLuaFPKf_cN6ccsddyOCkvwsGy4Ns3pA';

function getSheetByName(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(name);
}

function rowsToObjects(values) {
  if (!values || values.length < 1) return [];
  var headers = values[0].map(function(h) { return (''+h).trim(); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      if (val instanceof Date) {
        try {
          val = Utilities.formatDate(val, 'Asia/Jakarta', "dd/MM/yyyy HH:mm 'WIB'");
        } catch (e) {
          val = val.toString();
        }
      } else if (typeof val === 'string') {
        var isoMatch = val.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z?$/);
        if (isoMatch) {
          try {
            var d = new Date(val);
            if (!isNaN(d.getTime())) {
              val = Utilities.formatDate(d, 'Asia/Jakarta', "dd/MM/yyyy HH:mm 'WIB'");
            }
          } catch (e) {}
        }
      }
      obj[headers[j]] = val;
    }
    // rowNumber in sheet (1-based). +1 because values[0] is header, and i starts at 1
    obj.rowId = String(i + 1);
    out.push(obj);
  }
  return out;
}

function normalizeHeader(h) {
  return (''+h).toString().trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9]/g, '');
}

function getHeaderIndex(headers, targetName) {
  var normTarget = normalizeHeader(targetName);
  for (var i = 0; i < headers.length; i++) {
    if (normalizeHeader(headers[i]) === normTarget) return i;
  }
  return -1;
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

    // Endpoint: ?action=validasi
    // Endpoint: ?action=update (support via GET for simpler client calls)
    if (action === 'update') {
      return doUpdate(e.parameter || {});
    }
    if (action === 'validasi') {
      var sheet = getSheetByName('Validasi');
      if (!sheet) return jsonResponse({ error: 'Sheet Validasi tidak ditemukan' });
      var vals = sheet.getDataRange().getValues();
      if (!vals || vals.length < 2) return jsonResponse({ smpn: [], sman: [], smkn: [], tempat: [], konsultan: [] });

      var headers = vals[0].map(function(h){ return (''+h).trim(); });
      var smpnIdx = headers.findIndex(function(h){ return /smpn/i.test(h); });
      var smanIdx = headers.findIndex(function(h){ return /sman/i.test(h); });
      var smknIdx = headers.findIndex(function(h){ return /smkn/i.test(h); });
      var tempatIdx = headers.findIndex(function(h){ return /tempat/i.test(h); });
      var konsultanIdx = headers.findIndex(function(h){ return /konsultan/i.test(h); });

      var smpnSet = [], smanSet = [], smknSet = [], tempatSet = [], konsultanSet = [];

      for (var r = 1; r < vals.length; r++) {
        var row = vals[r];
        if (smpnIdx >= 0) {
          var v = (row[smpnIdx] || '').toString().trim();
          if (v && smpnSet.indexOf(v) === -1) smpnSet.push(v);
        }
        if (smanIdx >= 0) {
          var v2 = (row[smanIdx] || '').toString().trim();
          if (v2 && smanSet.indexOf(v2) === -1) smanSet.push(v2);
        }
        if (smknIdx >= 0) {
          var v3 = (row[smknIdx] || '').toString().trim();
          if (v3 && smknSet.indexOf(v3) === -1) smknSet.push(v3);
        }
        if (tempatIdx >= 0) {
          var v4 = (row[tempatIdx] || '').toString().trim();
          if (v4 && tempatSet.indexOf(v4) === -1) tempatSet.push(v4);
        }
        if (konsultanIdx >= 0) {
          var v5 = (row[konsultanIdx] || '').toString().trim();
          if (v5 && konsultanSet.indexOf(v5) === -1) konsultanSet.push(v5);
        }
      }

      return jsonResponse({ smpn: smpnSet, sman: smanSet, smkn: smknSet, tempat: tempatSet, konsultan: konsultanSet });
    }

    // Endpoint: ?action=data_masuk
    if (action === 'data_masuk') {
      var sheet2 = getSheetByName('Data Masuk');
      if (!sheet2) {
        sheet2 = getSheetByName('Data masuk');
      }
      if (!sheet2) return jsonResponse({ error: 'Sheet Data Masuk tidak ditemukan' });
      var values = sheet2.getDataRange().getValues();
      var objects = rowsToObjects(values);
      return jsonResponse(objects);
    }

    return jsonResponse({ ok: true, message: 'Apps Script webapp running' });
  } catch (err) {
    return jsonResponse({ error: err.message || err.toString() });
  }
}

function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try { payload = JSON.parse(e.postData.contents); } catch (err) { payload = {}; }
    }

    var action = payload.action || (e && e.parameter && e.parameter.action) || 'append';

    if (action === 'update') {
      return doUpdate(payload);
    } else {
      return doAppend(payload);
    }
  } catch (err) {
    return jsonResponse({ error: err.message || err.toString() });
  }
}

function doAppend(payload) {
  var sheet = getSheetByName('Data Masuk');
  if (!sheet) sheet = getSheetByName('Data masuk');
  if (!sheet) return jsonResponse({ error: 'Sheet Data Masuk tidak ditemukan' });

  var headers = sheet.getDataRange().getValues()[0] || [];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var key = (''+headers[i]).trim().toLowerCase();
    var value = '';
    if (key.match(/timestamp/)) value = payload.timestamp || new Date();
    else if (key.match(/nama/) && key.match(/siswa/)) value = payload.namaSiswa || '';
    else if (key.match(/whats/i)) value = payload.whatsappSiswa || payload.whatsappOrtu || '';
    else if (key.match(/orang/) && key.match(/tua|wali/)) value = payload.namaOrangTua || '';
    else if (key.match(/alamat/)) value = payload.alamatRumah || '';
    else if (key.match(/jalur/)) value = payload.jalurMasuk || '';
    else if (key.match(/asal/) && key.match(/sekolah/)) value = payload.asalSekolah || '';
    else if (key.match(/target/)) value = payload.sekolahTarget || '';
    else if (key.match(/sekolah/)) value = payload.asalSekolah || payload.sekolahTarget || '';
    else if (key.match(/tempat/)) value = payload.tempatKonsultasi || '';
    else if (key.match(/tanggal/)) value = payload.tanggalKonsultasi || '';
    else if (key.match(/waktu/)) value = payload.waktuKonsultasi || '';
    else if (key.match(/konsultan/)) value = payload.konsultan || '';
    else if (key.match(/status/)) value = payload.status || '';
    else value = payload[key] || '';

    row.push(value);
  }

  sheet.appendRow(row);
  return jsonResponse({ status: 'success', action: 'append' });
}

function doUpdate(payload) {
  var sheet = getSheetByName('Data Masuk');
  if (!sheet) sheet = getSheetByName('Data masuk');
  if (!sheet) return jsonResponse({ error: 'Sheet Data Masuk tidak ditemukan' });

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h){ return (''+h).toString().trim(); });
  var tanggalIdx = getHeaderIndex(headers, 'Tanggal Konsultasi');
  var waktuIdx = getHeaderIndex(headers, 'Waktu Konsultasi');
  var konsultanIdx = getHeaderIndex(headers, 'Konsultan');
  var statusIdx = getHeaderIndex(headers, 'Status');

  var rowIndex = -1;

  // Jika client mengirim rowId (nomor baris sheet), gunakan langsung
  if (payload.rowId) {
    var parsed = parseInt(payload.rowId, 10);
    if (!isNaN(parsed) && parsed >= 2 && parsed <= rows.length) {
      rowIndex = parsed; // already 1-based sheet row number
    }
  }

  // Fallback: cari berdasarkan timestamp & namaSiswa (legacy)
  if (rowIndex === -1) {
    var timestampIdx = getHeaderIndex(rows[0], 'Timestamp');
    var namaIdx = getHeaderIndex(rows[0], 'Nama Siswa');
    for (var i = 1; i < rows.length; i++) {
      var tsMatch = timestampIdx >= 0 && rows[i][timestampIdx].toString() === (payload.timestamp || '');
      var namaMatch = namaIdx >= 0 && rows[i][namaIdx].toString() === (payload.namaSiswa || '');
      if (tsMatch && namaMatch) { rowIndex = i + 1; break; }
    }
  }

  if (rowIndex === -1) return jsonResponse({ error: 'Data tidak ditemukan untuk di-update' });

  // Ensure tanggal is stored in WIB format (dd/MM/yyyy HH:mm 'WIB')
  if (tanggalIdx >= 0 && payload.tanggalKonsultasi !== undefined) {
    var tVal = payload.tanggalKonsultasi || '';
    var formattedDate = tVal;

    // Try to parse common formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, and with time
    var ymdMatch = (''+tVal).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    var dmyMatch = (''+tVal).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T](\d{2}):(\d{2}))?/);
    if (ymdMatch) {
      var yy = parseInt(ymdMatch[1], 10);
      var mm = parseInt(ymdMatch[2], 10) - 1;
      var dd = parseInt(ymdMatch[3], 10);
      var hh = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
      var mi = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
      var dt = new Date(yy, mm, dd, hh, mi);
      formattedDate = Utilities.formatDate(dt, 'Asia/Jakarta', "dd/MM/yyyy HH:mm 'WIB'");
    } else if (dmyMatch) {
      var dd2 = parseInt(dmyMatch[1], 10);
      var mm2 = parseInt(dmyMatch[2], 10) - 1;
      var yy2 = parseInt(dmyMatch[3], 10);
      var hh2 = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      var mi2 = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      var dt2 = new Date(yy2, mm2, dd2, hh2, mi2);
      formattedDate = Utilities.formatDate(dt2, 'Asia/Jakarta', "dd/MM/yyyy HH:mm 'WIB'");
    } else {
      // If already in some display form (e.g., '30/05/2026 17:10 WIB'), keep it
      formattedDate = tVal;
    }

    Logger.log('doUpdate: setting tanggal for row %s -> %s (raw: %s)', rowIndex, formattedDate, tVal);
    sheet.getRange(rowIndex, tanggalIdx + 1).setValue(formattedDate);
  }
  if (waktuIdx >= 0 && payload.waktuKonsultasi !== undefined) {
    Logger.log('doUpdate: setting waktu for row %s -> %s', rowIndex, payload.waktuKonsultasi);
    sheet.getRange(rowIndex, waktuIdx + 1).setValue(payload.waktuKonsultasi);
  }
  if (konsultanIdx >= 0 && payload.konsultan !== undefined) {
    Logger.log('doUpdate: setting konsultan for row %s -> %s', rowIndex, payload.konsultan);
    sheet.getRange(rowIndex, konsultanIdx + 1).setValue(payload.konsultan);
  }
  if (statusIdx >= 0 && payload.status !== undefined) {
    Logger.log('doUpdate: setting status for row %s -> %s', rowIndex, payload.status);
    sheet.getRange(rowIndex, statusIdx + 1).setValue(payload.status);
  }

  Logger.log('doUpdate: completed update for row %s', rowIndex);

  return jsonResponse({ status: 'success', action: 'update', row: rowIndex });
}

function jsonResponse(obj) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
