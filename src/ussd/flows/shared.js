// Validation shared by every flow that collects a Merchant/Terminal ID or an
// alternative contact number, so the rules live in one place.

const ID_RE = /^\d{3,10}$/;
const CONTACT_RE = /^\+?\d{7,15}$/;
const MAX_DETAILS_LENGTH = 140;

function isValidId(input) {
  return ID_RE.test(input);
}

function isValidContact(input) {
  return CONTACT_RE.test(input);
}

function sanitizeDetails(input) {
  return input.trim().slice(0, MAX_DETAILS_LENGTH);
}

module.exports = { isValidId, isValidContact, sanitizeDetails, MAX_DETAILS_LENGTH };
