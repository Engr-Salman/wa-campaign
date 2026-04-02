const Papa = require('papaparse');
const XLSX = require('xlsx');
const fs = require('fs');
const { validatePhone, normalizePhone } = require('./phoneValidator');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });
  return mapContacts(result.data);
}

function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: '',
  });
  // Normalize headers
  const normalized = data.map((row) => {
    const newRow = {};
    for (const [key, value] of Object.entries(row)) {
      newRow[key.trim().toLowerCase().replace(/\s+/g, '_')] = value;
    }
    return newRow;
  });
  return mapContacts(normalized);
}

function mapContacts(rows) {
  const seen = new Set();
  const contacts = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawPhone = row.phone_number || row.phone || row.number || row.mobile || '';
    const { valid, normalized, reason } = validatePhone(rawPhone);

    if (seen.has(normalized)) {
      duplicateCount++;
      contacts.push({
        row_number: i + 1,
        phone_number: normalized,
        name: row.name || '',
        custom_field_1: row.custom_field_1 || '',
        custom_field_2: row.custom_field_2 || '',
        status: 'skipped',
        error_message: 'Duplicate number',
      });
      continue;
    }

    if (!valid) {
      invalidCount++;
      contacts.push({
        row_number: i + 1,
        phone_number: normalized || rawPhone,
        name: row.name || '',
        custom_field_1: row.custom_field_1 || '',
        custom_field_2: row.custom_field_2 || '',
        status: 'invalid',
        error_message: reason,
      });
    } else {
      validCount++;
      seen.add(normalized);
      contacts.push({
        row_number: i + 1,
        phone_number: normalized,
        name: row.name || '',
        custom_field_1: row.custom_field_1 || '',
        custom_field_2: row.custom_field_2 || '',
        status: 'pending',
        error_message: null,
      });
    }
  }

  return { contacts, validCount, invalidCount, duplicateCount, total: rows.length };
}

module.exports = { parseCSV, parseExcel };
