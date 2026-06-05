const AI_SERVICE_URL = (
  process.env.AI_SERVICE_URL || "http://localhost:8000"
).replace(/\/$/, "");

async function requestAi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI service ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export function getAi<T>(path: string): Promise<T> {
  return requestAi<T>(path);
}

export function postAi<T>(path: string, payload: unknown): Promise<T> {
  return requestAi<T>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAiServiceUrl(): string {
  return AI_SERVICE_URL;
}