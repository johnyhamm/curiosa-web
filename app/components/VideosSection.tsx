// Shows the latest video from each tracked Sorcery YouTube channel.
// Reuses the RSS fetch/parse logic in lib/youtube.ts (also powers /api/youtube).

import { fetchRecentVideos } from "@/lib/youtube";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export async function VideosSection() {
  const videos = (await fetchRecentVideos(2)).filter((v) => v.url && v.title);
  if (videos.length === 0) return null;

  return (
    <section className="mt-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 shrink-0">
          Latest Videos
        </h2>
        <div className="flex-1 border-t border-gray-800" />
        <span className="text-xs text-gray-600 shrink-0">YouTube ↗</span>
      </div>

      {/* Video grid — smaller tiles, more per row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {videos.map((v) => (
          <a
            key={v.videoId ?? v.handle}
            href={v.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col bg-gray-900 border border-gray-800 rounded-lg
              overflow-hidden hover:border-gray-700 transition-colors"
          >
            {/* Thumbnail with play overlay */}
            <div className="relative aspect-video overflow-hidden bg-gray-800">
              {v.thumbnail ? (
                <img
                  src={v.thumbnail}
                  alt={v.title ?? v.channelName}
                  className="w-full h-full object-cover transition-transform duration-300
                    group-hover:scale-105"
                  loading="lazy"
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center
                  group-hover:bg-red-600/90 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="flex flex-col gap-1 p-2.5 flex-1">
              <p className="text-[11px] font-semibold text-amber-500 truncate">{v.channelName}</p>
              <h3 className="text-xs font-semibold text-white leading-snug line-clamp-2
                group-hover:text-amber-400 transition-colors">
                {v.title}
              </h3>
              {v.published && (
                <p className="text-[10px] text-gray-600 mt-0.5">{formatDate(v.published)}</p>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
