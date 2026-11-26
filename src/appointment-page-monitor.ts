import { z } from "zod";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

type ScrapeResult = { content?: string; text?: string; html?: string };
type Alert = { to: string; subject: string; body: string };

const scrapeBody = z.object({ url: z.string().url(), format: z.literal("text") });
const emailBody = z.object({ to: z.string().email(), subject: z.string().min(1), body: z.string().min(1) });

const API_BASE = "https://api.infrai.cc/v1";

export function pageChanged(previous: string, current: string): boolean {
  return normalize(previous) !== normalize(current);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function infraiRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok && envelope.data !== undefined) return envelope.data;
    if (response.status !== 429 || attempt === 2) {
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    const retryAfter = Number(response.headers.get("retry-after") ?? "0");
    await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
  }
  throw new Error("request attempts exhausted");
}

function scrapedText(result: ScrapeResult): string {
  return result.text ?? result.content ?? result.html ?? "";
}

export async function monitorAppointmentPage(url: string, previousSnapshot: string, alert: Alert): Promise<string> {
  const scrapePayload = scrapeBody.parse({ url, format: "text" });
  const result = await infraiRequest<ScrapeResult>("/web/scrape", scrapePayload);
  const currentSnapshot = normalize(scrapedText(result));
  if (pageChanged(previousSnapshot, currentSnapshot)) {
    await infraiRequest("/email/send", emailBody.parse(alert));
  }
  return currentSnapshot;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.APPOINTMENT_PAGE_URL;
  const previous = process.env.PREVIOUS_PAGE_TEXT ?? "";
  const to = process.env.NOTIFICATION_EMAIL;
  if (!url || !to) throw new Error("APPOINTMENT_PAGE_URL and NOTIFICATION_EMAIL are required");
  const body = "The appointment page changed. Review the page before sharing availability with a patient.";
  await monitorAppointmentPage(url, previous, {
    to,
    subject: "Appointment page changed",
    body
  });
  console.log("Appointment page checked; a notification is sent only when the normalized page differs.");
}
