import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function newToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function setToken(token: string) {
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { captureToken: token },
    create: { id: "singleton", captureToken: token },
  });
}

/** Returns the capture token, generating one on first use. */
export async function GET() {
  const s = await prisma.settings.findUnique({ where: { id: "singleton" } }).catch(() => null);
  if (s?.captureToken) return Response.json({ token: s.captureToken });
  const token = newToken();
  await setToken(token);
  return Response.json({ token });
}

/** Regenerates the capture token. */
export async function POST() {
  const token = newToken();
  await setToken(token);
  return Response.json({ token });
}
