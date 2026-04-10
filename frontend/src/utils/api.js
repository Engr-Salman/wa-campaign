export async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const fallbackMessage =
      text.trim() || `Request failed with status ${response.status}`;

    throw new Error(fallbackMessage);
  }
}

export async function readJsonOrThrow(response, fallbackMessage) {
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage || 'Request failed');
  }

  return data;
}
