/**
 * Validates and normalizes phone numbers for WhatsApp.
 * Numbers should be in international format without + prefix.
 */

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[\s\-\(\)\+\.]/g, '');
  // Remove leading zeros if followed by country code pattern
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

function validatePhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { valid: false, normalized, reason: 'Empty phone number' };
  }
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, normalized, reason: 'Contains non-numeric characters' };
  }
  if (normalized.length < 10) {
    return { valid: false, normalized, reason: 'Too short (< 10 digits)' };
  }
  if (normalized.length > 15) {
    return { valid: false, normalized, reason: 'Too long (> 15 digits)' };
  }
  return { valid: true, normalized, reason: null };
}

/**
 * Formats a phone number for whatsapp-web.js (number@c.us)
 */
function formatForWhatsApp(phone) {
  const normalized = normalizePhone(phone);
  return `${normalized}@c.us`;
}

module.exports = { normalizePhone, validatePhone, formatForWhatsApp };
