"use client";

import { useFeedback } from "./FeedbackProvider";

export function FeedbackNavButton() {
  const { openFeedback } = useFeedback();
  return (
    <button
      onClick={openFeedback}
      className="px-3 py-2 rounded-md text-sm font-medium text-gray-300
        hover:text-white hover:bg-gray-800 transition-colors"
    >
      Feedback
    </button>
  );
}
