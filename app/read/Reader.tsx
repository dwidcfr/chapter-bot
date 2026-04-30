"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const NUM_PAGES = 400;
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
      };
    };
  }
}

function pageUrl(p: number): string {
  return `/pages/page-${String(p).padStart(3, "0")}.jpg`;
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
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>("page");
  const [hydrated, setHydrated] = useState(false);

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
      if (saved.page) setPage(Math.max(1, Math.min(NUM_PAGES, saved.page)));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) persist({ page, mode });
  }, [page, mode, hydrated]);

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);
  const goNext = useCallback(() => {
    setPage((p) => Math.min(NUM_PAGES, p + 1));
  }, []);

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
        setPage(NUM_PAGES);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, goNext, goPrev]);

  return (
    <div className="reader-root">
      <Toolbar
        mode={mode}
        page={page}
        onModeChange={setMode}
        onPageChange={(p) => setPage(Math.max(1, Math.min(NUM_PAGES, p)))}
      />

      <div className="reader-stage">
        {mode === "page" ? (
          <PageMode page={page} onPrev={goPrev} onNext={goNext} />
        ) : (
          <ScrollMode currentPage={page} onPageChange={setPage} />
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
      `}</style>
    </div>
  );
}

function Toolbar({
  mode,
  page,
  onModeChange,
  onPageChange,
}: {
  mode: Mode;
  page: number;
  onModeChange: (m: Mode) => void;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="toolbar">
      <button
        className="toolbar-btn"
        onClick={() => onModeChange(mode === "page" ? "scroll" : "page")}
        title={mode === "page" ? "Switch to scroll mode" : "Switch to page mode"}
      >
        {mode === "page" ? "Scroll mode" : "Page mode"}
      </button>

      <div className="page-input">
        <input
          type="number"
          min={1}
          max={NUM_PAGES}
          value={page}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isNaN(v)) onPageChange(v);
          }}
        />
        <span> / {NUM_PAGES}</span>
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
      `}</style>
    </div>
  );
}

function PageMode({
  page,
  onPrev,
  onNext,
}: {
  page: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const next = page + 1;
    if (next <= NUM_PAGES) {
      const img = new Image();
      img.src = pageUrl(next);
    }
    const prev = page - 1;
    if (prev >= 1) {
      const img = new Image();
      img.src = pageUrl(prev);
    }
  }, [page]);

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
    <div className="page-mode" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="page-img-wrap">
        <img
          key={page}
          src={pageUrl(page)}
          alt={`Page ${page}`}
          draggable={false}
        />
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
        disabled={page >= NUM_PAGES}
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
        .page-img-wrap {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        img {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          background: #ffffff;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          border-radius: 4px;
          user-select: none;
          -webkit-user-drag: none;
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
  currentPage,
  onPageChange,
}: {
  currentPage: number;
  onPageChange: (p: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const didInitialJump = useRef(false);

  const pageNumbers = useMemo(
    () => Array.from({ length: NUM_PAGES }, (_, i) => i + 1),
    []
  );

  useEffect(() => {
    if (didInitialJump.current) return;
    const target = pageRefs.current[currentPage - 1];
    if (target) {
      target.scrollIntoView({ block: "start" });
      didInitialJump.current = true;
    }
  }, [currentPage]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let topVisible: { page: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const p = Number(
            (entry.target as HTMLElement).dataset.pageNumber ?? "0"
          );
          if (!p) continue;
          if (!topVisible || entry.intersectionRatio > topVisible.ratio) {
            topVisible = { page: p, ratio: entry.intersectionRatio };
          }
        }
        if (topVisible) onPageChange((topVisible as { page: number }).page);
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [onPageChange]);

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
          <img
            src={pageUrl(p)}
            alt={`Page ${p}`}
            width={632}
            height={1021}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
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
          max-width: 700px;
          background: #ffffff;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }
        .scroll-page img {
          display: block;
          width: 100%;
          height: auto;
          user-select: none;
          -webkit-user-drag: none;
        }
      `}</style>
    </div>
  );
}
