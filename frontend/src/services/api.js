const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      if (payload.error) {
        errorMessage = payload.error;
      }
    } catch {
      // Ignore JSON parse failures and fallback to default message.
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export async function fetchSafeRoute(payload) {
  return request("/route/safety-check", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchRoadsByBbox(bbox) {
  return request(`/osm/roads?bbox=${bbox.join(",")}`);
}
