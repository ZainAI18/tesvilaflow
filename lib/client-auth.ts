export type ClientSession = {
  token: string;
  username: string;
  userId: string;
  displayName: string;
  access: "full";
};

let currentSession: ClientSession | null = null;

export function setClientSession(session: ClientSession | null) {
  currentSession = session;
}

export function getClientSession() {
  return currentSession;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (!currentSession) {
    return new Response(JSON.stringify({ error: "Please log in again." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${currentSession.token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    currentSession = null;
    window.dispatchEvent(new Event("tesvila-session-expired"));
  }
  return response;
}
