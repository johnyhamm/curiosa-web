"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { FeedbackModal } from "./FeedbackModal";

// ─── Context ──────────────────────────────────────────────────────────────────

interface FeedbackContextValue {
  openFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue>({
  openFeedback: () => {},
});

export function useFeedback() {
  return useContext(FeedbackContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openFeedback  = useCallback(() => setIsOpen(true), []);
  const closeFeedback = useCallback(() => setIsOpen(false), []);

  return (
    <FeedbackContext.Provider value={{ openFeedback }}>
      {children}

      {/* Floating pill button — always visible in bottom-right */}
      <button
        onClick={openFeedback}
        aria-label="Send feedback"
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2
          px-4 py-2.5 rounded-full
          bg-gray-800 hover:bg-gray-700
          border border-gray-700 hover:border-gray-600
          text-sm font-medium text-gray-300 hover:text-white
          shadow-lg hover:shadow-xl
          transition-all duration-150 hover:scale-105"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0
              012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" />
        </svg>
        Feedback
      </button>

      {/* Modal — rendered once at app root */}
      <FeedbackModal isOpen={isOpen} onClose={closeFeedback} />
    </FeedbackContext.Provider>
  );
}
