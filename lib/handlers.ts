import { BOOK_DATA, Question } from "./bookData";
import {
  answerCallbackQuery,
  editMessageText,
  InlineKeyboardMarkup,
  sendMessage,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from "./telegram";

const SQUARE_CORRECT = "\u{1F7E9}"; // 🟩
const SQUARE_INCORRECT = "\u{1F7E5}"; // 🟥
const SQUARE_OPEN_ANSWERED = "\u{1F7E6}"; // 🟦
const CIRCLE_CURRENT = "\u{1F7E1}"; // 🟡
const SQUARE_FUTURE = "\u2B1C"; // ⬜

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getMainMenu(): InlineKeyboardMarkup {
  const rows: { text: string; callback_data: string }[][] = [];
  let row: { text: string; callback_data: string }[] = [];

  const sortedChapters = Object.keys(BOOK_DATA).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (const chapter of sortedChapters) {
    row.push({ text: `Chapter ${chapter}`, callback_data: `q_${chapter}_` });
    if (row.length === 3) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);

  return { inline_keyboard: rows };
}

function getQuestionMarkup(chapterId: string, history: string): InlineKeyboardMarkup {
  const questions = BOOK_DATA[chapterId];
  const qIdx = history.length;
  const question = questions[qIdx];
  const rows: { text: string; callback_data: string }[][] = [];

  question.options.forEach((optionText, optIndex) => {
    rows.push([
      { text: optionText, callback_data: `q_${chapterId}_${history}${optIndex}` },
    ]);
  });

  rows.push([{ text: "\u2B05\uFE0F Stop & Exit to Menu", callback_data: "m" }]);

  return { inline_keyboard: rows };
}

function getReportMarkup(chapterId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "\u{1F504} Restart Test", callback_data: `q_${chapterId}_` }],
      [{ text: "\u{1F4DA} Choose Another Chapter", callback_data: "m" }],
    ],
  };
}

function progressBar(chapterId: string, history: string): string {
  const questions = BOOK_DATA[chapterId];
  const total = questions.length;
  const currentIdx = history.length;

  let bar = "";
  for (let i = 0; i < total; i++) {
    if (i < currentIdx) {
      const q = questions[i];
      const userAns = q.options[parseInt(history[i], 10)];
      if (q.correct === undefined) bar += SQUARE_OPEN_ANSWERED;
      else if (userAns === q.correct) bar += SQUARE_CORRECT;
      else bar += SQUARE_INCORRECT;
    } else if (i === currentIdx) {
      bar += CIRCLE_CURRENT;
    } else {
      bar += SQUARE_FUTURE;
    }
  }
  return bar;
}

function buildQuestionMessage(chapterId: string, history: string): string {
  const questions = BOOK_DATA[chapterId];
  const qIdx = history.length;
  const question = questions[qIdx];

  return [
    `\u{1F4DA} <b>Chapter ${chapterId}</b>`,
    progressBar(chapterId, history),
    `Question <b>${qIdx + 1}/${questions.length}</b>`,
    "",
    escapeHtml(question.text),
  ].join("\n");
}

function questionFirstLine(q: Question): string {
  const firstLine = q.text.split("\n")[0];
  return firstLine.length > 100 ? firstLine.slice(0, 97) + "\u2026" : firstLine;
}

function motivationalMessage(pct: number): string {
  if (pct === 100) return "\u{1F3C6} Perfect score!";
  if (pct >= 90) return "\u{1F31F} Outstanding work!";
  if (pct >= 75) return "\u{1F44F} Great job!";
  if (pct >= 60) return "\u{1F4AA} Keep practicing to improve.";
  return "\u{1F4D6} Re-read the chapter and try again.";
}

const SEPARATOR = "______________________________";

function buildReportMessage(chapterId: string, history: string): string {
  const questions = BOOK_DATA[chapterId];
  let scored = 0;
  let correctCount = 0;
  let openCount = 0;
  let body = "";

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const userAnsIdx = parseInt(history[i] ?? "0", 10);
    const userAnswer = q.options[userAnsIdx] ?? "(no answer)";
    const heading = escapeHtml(questionFirstLine(q));

    if (q.correct === undefined) {
      openCount++;
      body += `${heading}\n\u{1F4DD} Open question (no scoring)\n${SEPARATOR}\n`;
    } else {
      scored++;
      const ok = userAnswer === q.correct;
      if (ok) correctCount++;
      const emoji = ok ? "\u2705" : "\u274C";
      body += `${heading}\n${emoji} Your: <b>${escapeHtml(userAnswer)}</b>\nCorrect: <b>${escapeHtml(
        q.correct
      )}</b>\n${SEPARATOR}\n`;
    }
  }

  const incorrect = scored - correctCount;
  const pct = scored > 0 ? Math.round((correctCount / scored) * 100) : 0;
  const openLine = openCount > 0 ? `\n\u{1F4DD} Open questions: <b>${openCount}</b>` : "";

  const header = [
    `\u{1F4DA} <b>Chapter ${chapterId}</b>`,
    "",
    "\u{1F3C1} <b>Test Finished!</b> \u{1F389}",
    "",
    "\u{1F4CA} Detailed Report:",
    SEPARATOR,
  ].join("\n");

  const footer = [
    "",
    `\u2705 Correct: <b>${correctCount}</b>`,
    `\u274C Incorrect: <b>${incorrect}</b>`,
    `\u{1F4C8} Final Score: <b>${pct}%</b>${openLine}`,
    "",
    motivationalMessage(pct),
    "",
    "Click below to restart or choose another chapter.",
  ].join("\n");

  let full = `${header}\n${body}${footer}`;

  // Telegram message limit is 4096 chars. If we exceed (e.g. very long
  // questions in a 25-question chapter), retry with a compact body.
  if (full.length > 4000) {
    let compact = "";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAnsIdx = parseInt(history[i] ?? "0", 10);
      const userAnswer = q.options[userAnsIdx] ?? "?";
      if (q.correct === undefined) {
        compact += `${i + 1}. \u{1F4DD} Open question\n`;
      } else {
        const ok = userAnswer === q.correct;
        const emoji = ok ? "\u2705" : "\u274C";
        compact += `${i + 1}. ${emoji} Your: <b>${escapeHtml(
          userAnswer
        )}</b> | Correct: <b>${escapeHtml(q.correct)}</b>\n`;
      }
    }
    full = `${header}\n${compact}${footer}`;
  }

  return full;
}

async function handleStart(message: TelegramMessage): Promise<void> {
  await sendMessage({
    chat_id: message.chat.id,
    text: "Welcome to 'The Secret Garden' Reading Exercises! \u{1F33F}\n\nPlease select a chapter:",
    reply_markup: getMainMenu(),
  });
}

async function goToMainMenu(call: TelegramCallbackQuery): Promise<void> {
  if (!call.message) return;
  await editMessageText({
    chat_id: call.message.chat.id,
    message_id: call.message.message_id,
    text: "Please select a chapter:",
    reply_markup: getMainMenu(),
  });
}

async function showQuestionOrReport(call: TelegramCallbackQuery, chapterId: string, history: string): Promise<void> {
  if (!call.message) return;
  if (!BOOK_DATA[chapterId]) return;

  const questions = BOOK_DATA[chapterId];

  if (history.length >= questions.length) {
    await editMessageText({
      chat_id: call.message.chat.id,
      message_id: call.message.message_id,
      text: buildReportMessage(chapterId, history),
      reply_markup: getReportMarkup(chapterId),
      parse_mode: "HTML",
    });
    return;
  }

  await editMessageText({
    chat_id: call.message.chat.id,
    message_id: call.message.message_id,
    text: buildQuestionMessage(chapterId, history),
    reply_markup: getQuestionMarkup(chapterId, history),
    parse_mode: "HTML",
  });
}

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  try {
    if (update.message?.text) {
      const text = update.message.text.trim();
      if (text === "/start" || text.startsWith("/start ") || text === "/start@") {
        await handleStart(update.message);
        return;
      }
    }

    if (update.callback_query) {
      const call = update.callback_query;
      const data = call.data ?? "";

      try {
        if (data === "m" || data === "main_menu") {
          await goToMainMenu(call);
        } else if (data.startsWith("q_")) {
          const rest = data.slice(2); // strip "q_"
          const sepIdx = rest.indexOf("_");
          if (sepIdx >= 0) {
            const chapterId = rest.slice(0, sepIdx);
            const history = rest.slice(sepIdx + 1);
            await showQuestionOrReport(call, chapterId, history);
          }
        } else if (data.startsWith("startchap_")) {
          // Backwards compat with old buttons still in chat history.
          const chapterId = data.split("_")[1];
          await showQuestionOrReport(call, chapterId, "");
        }
      } finally {
        await answerCallbackQuery({ callback_query_id: call.id }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[handleUpdate]", err);
  }
}
