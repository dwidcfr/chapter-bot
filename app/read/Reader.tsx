"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PDF_URL = "/the-secret-garden.pdf";
const STORAGE_KEY = "tsg-reader-state-v1";

type Mode = "page" | "scroll";

interface SavedState {
  page: number;
  mode: Mode;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        themeParams?: Record<string, string>;
        colorScheme?: "light" | "dark";
        BackButton?: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
      };
    };
  }
}

function loadSaved(): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedState) : null;
  } catch {
    return null;
  }
}

function persist(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export default function Reader() {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>("page");
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const tryInit = () => {
      if (cancelled) return;
      const tg = window.Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch {}
        return;
      }
      if (tries++ < 40) setTimeout(tryInit, 100);
    };
    tryInit();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      if (saved.mode) setMode(saved.mode);
      if (saved.page) setPage(saved.page);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const task = pdfjs.getDocument({ url: PDF_URL, disableAutoFetch: true, disableStream: false });
        task.onProgress = (p: { loaded: number; total: number }) => {
          if (p.total) setLoadProgress(Math.round((p.loaded / p.total) * 100));
        };
        const doc = await task.promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load PDF");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) persist({ page, mode });
  }, [page, mode, loading]);

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);
  const goNext = useCallback(() => {
    setPage((p) => Math.min(numPages || 1, p + 1));
  }, [numPages]);

  useEffect(() => {
    if (mode !== "page") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        setPage(1);
      } else if (e.key === "End") {
        setPage(numPages || 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, goNext, goPrev, numPages]);

  return (
    <div className="reader-root">
      <Toolbar
        mode={mode}
        page={page}
        numPages={numPages}
        onModeChange={setMode}
        onPageChange={(p) => setPage(Math.max(1, Math.min(numPages || 1, p)))}
        disabled={loading || !!error}
      />

      <div className="reader-stage" ref={containerRef}>
        {loading && (
          <div className="reader-msg">
            <div className="spinner" />
            <p>Loading book&hellip; {loadProgress}%</p>
          </div>
        )}

        {error && (
          <div className="reader-msg reader-error">
            <p>Could not load the book.</p>
            <p className="reader-error-detail">{error}</p>
          </div>
        )}

        {!loading && !error && pdf && mode === "page" && (
          <PageMode
            pdf={pdf}
            page={page}
            numPages={numPages}
            onPrev={goPrev}
            onNext={goNext}
          />
        )}

        {!loading && !error && pdf && mode === "scroll" && (
          <ScrollMode
            pdf={pdf}
            numPages={numPages}
            currentPage={page}
            onPageChange={setPage}
          />
        )}
      </div>

      <style jsx>{`
        .reader-root {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          background: var(--tg-theme-bg-color, #0b0f14);
          color: var(--tg-theme-text-color, #e6edf3);
        }
        .reader-stage {
          flex: 1;
          min-height: 0;
          position: relative;
          overflow: hidden;
        }
        .reader-msg {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 24px;
          text-align: center;
          color: var(--tg-theme-hint-color, #9aa6b2);
        }
        .reader-error-detail {
          font-size: 12px;
          opacity: 0.7;
          word-break: break-word;
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          opacity: 0.7;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

function Toolbar({
  mode,
  page,
  numPages,
  onModeChange,
  onPageChange,
  disabled,
}: {
  mode: Mode;
  page: number;
  numPages: number;
  onModeChange: (m: Mode) => void;
  onPageChange: (p: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="toolbar">
      <button
        className="toolbar-btn"
        onClick={() => onModeChange(mode === "page" ? "scroll" : "page")}
        disabled={disabled}
        title={mode === "page" ? "Switch to scroll mode" : "Switch to page mode"}
      >
        {mode === "page" ? "Scroll mode" : "Page mode"}
      </button>

      <div className="page-input">
        <input
          type="number"
          min={1}
          max={numPages || 1}
          value={page}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isNaN(v)) onPageChange(v);
          }}
          disabled={disabled}
        />
        <span> / {numPages || "\u2026"}</span>
      </div>

      <style jsx>{`
        .toolbar {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          background: var(--tg-theme-secondary-bg-color, #11161d);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .toolbar-btn {
          background: var(--tg-theme-button-color, #2f81f7);
          color: var(--tg-theme-button-text-color, #ffffff);
          border: none;
          border-radius: 999px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .toolbar-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .page-input {
          font-size: 13px;
          color: var(--tg-theme-hint-color, #9aa6b2);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .page-input input {
          width: 60px;
          background: transparent;
          color: inherit;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          padding: 4px 8px;
          text-align: center;
          font-size: 13px;
        }
        .page-input input:disabled {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}

function PageMode({
  pdf,
  page,
  numPages,
  onPrev,
  onNext,
}: {
  pdf: any;
  page: number;
  numPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) onNext();
    else onPrev();
  };

  return (
    <div
      ref={wrapperRef}
      className="page-mode"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="page-canvas-wrap">
        <PdfPage pdf={pdf} pageNumber={page} fit="contain" />
      </div>

      <button
        className="nav nav-left"
        aria-label="Previous page"
        onClick={onPrev}
        disabled={page <= 1}
      >
        &#8249;
      </button>
      <button
        className="nav nav-right"
        aria-label="Next page"
        onClick={onNext}
        disabled={page >= numPages}
      >
        &#8250;
      </button>

      <style jsx>{`
        .page-mode {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
        }
        .page-canvas-wrap {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 44px;
          height: 64px;
          background: rgba(0, 0, 0, 0.35);
          color: #ffffff;
          border: none;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .page-mode:hover .nav {
          opacity: 1;
        }
        .nav:disabled {
          opacity: 0;
          cursor: default;
        }
        .nav-left {
          left: 0;
          border-radius: 0 8px 8px 0;
        }
        .nav-right {
          right: 0;
          border-radius: 8px 0 0 8px;
        }
        @media (hover: none) {
          .nav {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function ScrollMode({
  pdf,
  numPages,
  currentPage,
  onPageChange,
}: {
  pdf: any;
  numPages: number;
  currentPage: number;
  onPageChange: (p: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const didInitialJump = useRef(false);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(() => new Set([1]));

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages]
  );

  useEffect(() => {
    if (didInitialJump.current) return;
    if (!numPages) return;
    const target = pageRefs.current[currentPage - 1];
    if (target) {
      target.scrollIntoView({ block: "start" });
      didInitialJump.current = true;
    }
  }, [numPages, currentPage]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let topVisible: { page: number; ratio: number } | null = null;
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const p = Number(
              (entry.target as HTMLElement).dataset.pageNumber ?? "0"
            );
            if (!p) continue;
            if (entry.isIntersecting) {
              next.add(p);
              if (!topVisible || entry.intersectionRatio > topVisible.ratio) {
                topVisible = { page: p, ratio: entry.intersectionRatio };
              }
            }
          }
          return next;
        });
        if (topVisible) onPageChange((topVisible as { page: number }).page);
      },
      { root, rootMargin: "200px 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [numPages, onPageChange]);

  return (
    <div className="scroll-mode" ref={scrollRef}>
      {pageNumbers.map((p) => (
        <div
          key={p}
          className="scroll-page"
          data-page-number={p}
          ref={(el) => {
            pageRefs.current[p - 1] = el;
          }}
        >
          {visiblePages.has(p) ? (
            <PdfPage pdf={pdf} pageNumber={p} fit="width" />
          ) : (
            <div className="scroll-placeholder">{p}</div>
          )}
        </div>
      ))}

      <style jsx>{`
        .scroll-mode {
          position: absolute;
          inset: 0;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .scroll-page {
          width: 100%;
          max-width: 900px;
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .scroll-placeholder {
          width: 100%;
          aspect-ratio: 3 / 4;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--tg-theme-hint-color, #9aa6b2);
          font-size: 28px;
          opacity: 0.4;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}

function PdfPage({
  pdf,
  pageNumber,
  fit,
}: {
  pdf: any;
  pageNumber: number;
  fit: "width" | "contain";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any;

    const render = async () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;

      try {
        const pdfPage = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const viewport1 = pdfPage.getViewport({ scale: 1 });
        const wrapW = wrap.clientWidth || 1;
        const wrapH = wrap.clientHeight || 1;

        let scale: number;
        if (fit === "width") {
          scale = wrapW / viewport1.width;
        } else {
          const sx = wrapW / viewport1.width;
          const sy = wrapH / viewport1.height;
          scale = Math.min(sx, sy);
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pdfPage.getViewport({ scale });
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        renderTask = pdfPage.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (e: any) {
        if (e?.name === "RenderingCancelledException") return;
        console.error("[PdfPage]", e);
      }
    };

    render();

    const ro = new ResizeObserver(() => {
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
      render();
    });
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {}
      }
    };
  }, [pdf, pageNumber, fit]);

  return (
    <div ref={wrapRef} className="pdf-page-wrap">
      <canvas ref={canvasRef} />
      <style jsx>{`
        .pdf-page-wrap {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        canvas {
          background: #ffffff;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          border-radius: 4px;
          max-width: 100%;
          max-height: 100%;
        }
      `}</style>
    </div>
  );
}
