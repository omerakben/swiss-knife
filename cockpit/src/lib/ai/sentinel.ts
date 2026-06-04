// Client-safe constant shared by the server stream helper and the client hook.
// Kept in its own module so importing it into a client component never pulls in
// server-only code (prisma, the ollama fetch client).

/** In-band marker the server injects so the client can surface a mid-stream error. */
export const ERROR_SENTINEL = "[[ERROR]]";
