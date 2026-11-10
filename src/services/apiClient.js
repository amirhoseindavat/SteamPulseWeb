export async function readApiResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("The SteamPulse API returned an empty response. Make sure both the Vite client and Express server are running with npm run dev.");
  }
  try { return JSON.parse(text); }
  catch {
    throw new Error("The API returned a non-JSON response. Open the app through the Vite dev server and check that the Express API is running on port 3001.");
  }
}

export async function requestJson(url, options = {}, fallbackMessage = "The request could not be completed.") {
  const response = await fetch(url, options);
  const data = await readApiResponse(response);
  if (!response.ok) throw new Error(data.error || data.detail || fallbackMessage);
  return data;
}
