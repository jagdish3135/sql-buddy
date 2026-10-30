// Vercel function: POST /api/ask turns a question into SQL; GET /api/ask says which AI is set up.
import { ask, status } from "../server/ask.js";

export function GET(): Response {
  return Response.json(status(process.env), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ mode: "error", message: "Body must be JSON." }, { status: 400 });
  }
  const { status: code, json } = await ask(body, process.env);
  return Response.json(json, { status: code, headers: { "cache-control": "no-store" } });
}
