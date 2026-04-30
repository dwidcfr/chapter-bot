import { BOOK_DATA } from "./bookData";
import {
  answerCallbackQuery,
  editMessageText,
  InlineKeyboardMarkup,
  sendMessage,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from "./telegram";

function getMainMenu(): InlineKeyboardMarkup {
  const rows: { text: string; callback_data: string }[][] = [];
  let row: { text: string; callback_data: string }[] = [];

  const sortedChapters = Object.keys(BOOK_DATA).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (const chapter of sortedChapters) {
    row.push({ text: `Chapter ${chapter}`, callback_data: `startchap_${chapter}` });
    if (row.length === 3) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);

  return { inline_keyboard: rows };
}

function getQuestionMarkup(chapterId: string, questionIndex: number): InlineKeyboardMarkup {
  const question = BOOK_DATA[chapterId][questionIndex];
  const rows: { text: string; callback_data: string }[][] = [];

  question.options.forEach((optionText, optIndex) => {
    rows.push([
      { text: optionText, callback_data: `q_${chapterId}_${questionIndex}_${optIndex}` },
    ]);
  });

  rows.push([{ text: "\u2b05\ufe0f Stop & Exit to Menu", callback_data: "main_menu" }]);

  return { inline_keyboard: rows };
}

async function handleStart(message: TelegramMessage): Promise<void> {
  await sendMessage({
    chat_id: message.chat.id,
    text: "Welcome to 'The Secret Garden' Reading Exercises! \ud83c\udf3f\n\nPlease select a chapter:",
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

async function startChapter(call: TelegramCallbackQuery): Promise<void> {
  if (!call.message || !call.data) return;

  const chapterId = call.data.split("_")[1];
  if (!BOOK_DATA[chapterId]) return;

  const questionIndex = 0;
  const firstQuestion = BOOK_DATA[chapterId][questionIndex].text;
  const text = `<b>Chapter ${chapterId}</b>\n\n${firstQuestion}`;

  await editMessageText({
    chat_id: call.message.chat.id,
    message_id: call.message.message_id,
    text,
    reply_markup: getQuestionMarkup(chapterId, questionIndex),
    parse_mode: "HTML",
  });
}

async function handleAnswer(call: TelegramCallbackQuery): Promise<void> {
  if (!call.message || !call.data) return;

  const parts = call.data.split("_");
  const chapterId = parts[1];
  const questionIndex = parseInt(parts[2], 10);

  if (!BOOK_DATA[chapterId] || Number.isNaN(questionIndex)) return;

  const nextIndex = questionIndex + 1;

  if (nextIndex < BOOK_DATA[chapterId].length) {
    const nextQuestion = BOOK_DATA[chapterId][nextIndex].text;
    const text = `<b>Chapter ${chapterId}</b>\n\n${nextQuestion}`;

    await editMessageText({
      chat_id: call.message.chat.id,
      message_id: call.message.message_id,
      text,
      reply_markup: getQuestionMarkup(chapterId, nextIndex),
      parse_mode: "HTML",
    });
  } else {
    const markup: InlineKeyboardMarkup = {
      inline_keyboard: [[{ text: "\u2b05\ufe0f Back to Chapters", callback_data: "main_menu" }]],
    };

    await editMessageText({
      chat_id: call.message.chat.id,
      message_id: call.message.message_id,
      text: `\ud83c\udf89 <b>Congratulations!</b> You have completed all exercises for Chapter ${chapterId}.`,
      reply_markup: markup,
      parse_mode: "HTML",
    });
  }
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
        if (data === "main_menu") {
          await goToMainMenu(call);
        } else if (data.startsWith("startchap_")) {
          await startChapter(call);
        } else if (data.startsWith("q_")) {
          await handleAnswer(call);
        }
      } finally {
        await answerCallbackQuery({ callback_query_id: call.id }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[handleUpdate]", err);
  }
}
