import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ollama";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const SYSTEM = `You are a prompt engineering assistant. Rewrite the user's prompt to be
clearer, more specific, and more effective for an LLM. Preserve intent. Add structure
(role, task, constraints, output format) where helpful. Return ONLY the improved prompt,
no preamble or explanation.`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, save, title } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing 'prompt'." }, { status: 400 });
    }

    const optimized = await chat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3 }
    );

    if (save) {
      await prisma.prompt.create({
        data: {
          title: (title || prompt.slice(0, 60)).trim(),
          original: prompt,
          optimized,
        },
      });
    }

    return NextResponse.json({ optimized });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
