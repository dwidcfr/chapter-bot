export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "64px 24px",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Chapter Bot</h1>
      <p style={{ color: "#9aa6b2", marginTop: 0 }}>
        Telegram bot with reading exercises for{" "}
        <em>The Secret Garden</em> (chapters 6&ndash;16).
      </p>

      <h2 style={{ marginTop: 40 }}>Status</h2>
      <p>The bot runs as a serverless webhook on this deployment.</p>
      <ul>
        <li>
          <code>POST /api/webhook</code> &mdash; Telegram update receiver
        </li>
        <li>
          <code>GET /api/set-webhook</code> &mdash; (re)register the webhook URL
          with Telegram
        </li>
        <li>
          <code>DELETE /api/set-webhook</code> &mdash; remove the webhook
        </li>
      </ul>

      <h2 style={{ marginTop: 40 }}>Mini App</h2>
      <p>
        The book reader is also available as a Telegram Mini App at{" "}
        <a href="/read">
          <code>/read</code>
        </a>{" "}
        &mdash; open it directly or wire it up in BotFather as your bot&apos;s Web
        App URL.
      </p>

      <h2 style={{ marginTop: 40 }}>Setup</h2>
      <ol>
        <li>
          Set the env vars <code>TELEGRAM_BOT_TOKEN</code> and{" "}
          <code>TELEGRAM_WEBHOOK_SECRET</code> in your Vercel project.
        </li>
        <li>
          Deploy, then visit <code>/api/set-webhook</code> once to register the
          webhook with Telegram.
        </li>
        <li>
          Open your bot in Telegram and send <code>/start</code>.
        </li>
      </ol>
    </main>
  );
}
