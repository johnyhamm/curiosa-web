"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = "bug" | "feature";
type Stage = "form" | "submitting" | "success" | "error";

export function FeedbackModal({ isOpen, onClose }: Props) {
  const [type, setType]               = useState<FeedbackType>("bug");
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage]             = useState<Stage>("form");
  const [issueUrl, setIssueUrl]       = useState<string | null>(null);
  const [issueNumber, setIssueNumber] = useState<number | null>(null);
  const [errorMsg, setErrorMsg]       = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset form each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setType("bug");
      setTitle("");
      setDescription("");
      setStage("form");
      setIssueUrl(null);
      setIssueNumber(null);
      setErrorMsg("");
      // Focus title after open animation
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setStage("submitting");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          description,
          pageUrl: window.location.href,
        }),
      });
      const data = await res.json() as {
        issueNumber?: number;
        issueUrl?: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStage("error");
      } else {
        setIssueNumber(data.issueNumber ?? null);
        setIssueUrl(data.issueUrl ?? null);
        setStage("success");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStage("error");
    }
  }

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">
            {stage === "success" ? "Feedback received!" : "Send feedback"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors rounded-md p-1 -mr-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Success ── */}
        {stage === "success" && (
          <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700/50
              flex items-center justify-center text-2xl">
              ✓
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Thanks! Your feedback has been submitted.
              {issueNumber && (
                <>
                  {" "}It was logged as{" "}
                  <a
                    href={issueUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    issue #{issueNumber}
                  </a>
                  .
                </>
              )}
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700
                text-sm font-medium text-white transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {stage === "error" && (
          <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-900/40 border border-red-700/50
              flex items-center justify-center text-2xl">
              ✕
            </div>
            <p className="text-gray-300 text-sm">{errorMsg}</p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setStage("form")}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500
                  text-sm font-medium text-white transition-colors"
              >
                Try again
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700
                  text-sm font-medium text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Form ── */}
        {(stage === "form" || stage === "submitting") && (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">

            {/* Type toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700 bg-gray-950 p-1 gap-1">
              {(["bug", "feature"] as FeedbackType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    type === t
                      ? t === "bug"
                        ? "bg-red-900/60 border border-red-700/50 text-red-300"
                        : "bg-violet-900/60 border border-violet-700/50 text-violet-300"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {t === "bug" ? "🐛 Bug report" : "✨ Feature request"}
                </button>
              ))}
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "bug"
                    ? "e.g. Simulation crashes when deck has no avatar"
                    : "e.g. Show card artwork in search results"
                }
                maxLength={120}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-gray-950 border border-gray-700
                  text-white text-sm placeholder-gray-600 focus:outline-none
                  focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 transition"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  type === "bug"
                    ? "Steps to reproduce, what you expected, what actually happened…"
                    : "Describe the feature and why it would be useful…"
                }
                rows={5}
                maxLength={2000}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-gray-950 border border-gray-700
                  text-white text-sm placeholder-gray-600 resize-none focus:outline-none
                  focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 transition"
              />
              <p className="text-xs text-gray-600 text-right">
                {description.length}/2000
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={stage === "submitting"}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700
                  text-sm font-medium text-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={stage === "submitting" || !title.trim() || !description.trim()}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900
                  disabled:opacity-50 text-sm font-semibold text-white transition-colors
                  flex items-center gap-2"
              >
                {stage === "submitting" ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Submitting…
                  </>
                ) : (
                  "Submit →"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
