function parseRestrictionValue(rawValue) {
  if (!rawValue || typeof rawValue !== "string") {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (
    !normalized ||
    normalized === "none" ||
    normalized === "no" ||
    normalized === "unlimited"
  ) {
    return null;
  }

  const match = normalized.match(/\d+(?:[.,]\d+)?/);
  if (!match) {
    return null;
  }

  return Number(match[0].replace(",", "."));
}

module.exports = {
  parseRestrictionValue,
};
