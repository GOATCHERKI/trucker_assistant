function normalizeMessage(rawMessage) {
  if (typeof rawMessage !== "string") {
    return "";
  }

  return rawMessage
    .replace(/\s+on road\s+\d+:/i, ":")
    .replace(/\s+/g, " ")
    .trim();
}

function detectWarningType(message, fallbackType) {
  if (fallbackType === "height" || fallbackType === "weight") {
    return fallbackType;
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("height") || normalized.includes("bridge")) {
    return "height";
  }

  return "weight";
}

function extractValues(message, type) {
  const normalized = message.toLowerCase();

  const typedRegex =
    type === "height"
      ? /truck\s+height\s+(\d+(?:\.\d+)?)m.*?max\s+(\d+(?:\.\d+)?)m/i
      : /truck\s+weight\s+(\d+(?:\.\d+)?)t.*?max\s+(\d+(?:\.\d+)?)t/i;

  const typedMatch = normalized.match(typedRegex);
  if (typedMatch) {
    return {
      truckValue: Number(typedMatch[1]),
      maxValue: Number(typedMatch[2]),
    };
  }

  const numericValues = [...message.matchAll(/\d+(?:\.\d+)?/g)].map((match) =>
    Number(match[0]),
  );

  return {
    truckValue: numericValues[0] ?? 0,
    maxValue: numericValues[1] ?? 0,
  };
}

export function transformWarnings(rawWarnings = []) {
  return rawWarnings
    .map((warning, index) => {
      const rawMessage =
        typeof warning === "string" ? warning : warning?.message;
      const message = normalizeMessage(rawMessage);

      if (!message) {
        return null;
      }

      const type = detectWarningType(message, warning?.type);
      const { truckValue, maxValue } = extractValues(message, type);

      return {
        id: String(index),
        sourceIndex: index,
        type,
        message,
        maxValue,
        truckValue,
      };
    })
    .filter(Boolean);
}
