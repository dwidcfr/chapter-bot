export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN env variable is not set");
  }
  return token;
}

async function callTelegram<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> {
  const token = getToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };

  if (!data.ok) {
    // Don't throw on "message is not modified" — that's a benign no-op when
    // the user double-taps the same answer.
    if (data.description && /message is not modified/i.test(data.description)) {
      return undefined as unknown as T;
    }
    throw new Error(`Telegram API error (${method}): ${data.description ?? "unknown"}`);
  }

  return data.result as T;
}

export function sendMessage(params: {
  chat_id: number;
  text: string;
  reply_markup?: InlineKeyboardMarkup;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
}): Promise<TelegramMessage> {
  return callTelegram<TelegramMessage>("sendMessage", params);
}

export function editMessageText(params: {
  chat_id: number;
  message_id: number;
  text: string;
  reply_markup?: InlineKeyboardMarkup;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
}): Promise<TelegramMessage> {
  return callTelegram<TelegramMessage>("editMessageText", params);
}

export function answerCallbackQuery(params: {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
}): Promise<boolean> {
  return callTelegram<boolean>("answerCallbackQuery", params);
}

export function setWebhook(params: {
  url: string;
  secret_token?: string;
  drop_pending_updates?: boolean;
  allowed_updates?: string[];
}): Promise<boolean> {
  return callTelegram<boolean>("setWebhook", params);
}

export function deleteWebhook(): Promise<boolean> {
  return callTelegram<boolean>("deleteWebhook", {});
}

export function getWebhookInfo(): Promise<unknown> {
  return callTelegram("getWebhookInfo", {});
}
