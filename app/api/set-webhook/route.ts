import { NextRequest, NextResponse } from "next/server";
import { deleteWebhook, getWebhookInfo, setWebhook } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveBaseUrl(req: NextRequest): string {
  const explicit =
    process.env.PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (explicit) return explicit.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const baseUrl = resolveBaseUrl(req);
  const webhookUrl = `${baseUrl}/api/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  try {
    const result = await setWebhook({
      url: webhookUrl,
      secret_token: secret,
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query"],
    });
    const info = await getWebhookInfo();
    return NextResponse.json({ ok: true, set: result, webhookUrl, info });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const result = await deleteWebhook();
    return NextResponse.json({ ok: true, deleted: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
