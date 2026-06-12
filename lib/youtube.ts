// Fetches the latest video for a set of Sorcery YouTube channels via their
// public RSS feeds (no API key required). Used by the /api/youtube endpoint.

export interface ChannelVideo {
  channelName: string;
  handle: string;
  channelUrl: string;
  videoId: string | null;
  title: string | null;
  url: string | null;
  published: string | null;
  thumbnail: string | null;
}

interface ChannelDef {
  handle: string;
  channelId: string;
}

// Channel IDs resolved from each @handle.
const CHANNELS: ChannelDef[] = [
  { handle: "CommonSenseSorcery", channelId: "UCrCpAOPrsn3iSH7xMyEvwsg" },
  { handle: "SorceryTCG",         channelId: "UCqmv-SKT0_SO5FbP3vGZ_uQ" },
  { handle: "ArchivesOfTheRealm", channelId: "UCjN3qLn5iH2UenbQMNquejQ" },
  { handle: "CollectorArthouse",  channelId: "UCTyYXZelkHli1vSzDw-OO3Q" },
  { handle: "CardboardGuide",     channelId: "UCkI76BFK6-hKNI1nndQSp9A" },
];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

/** Fetch up to `limit` most-recent videos for a single channel. */
async function fetchChannelVideos(def: ChannelDef, limit: number): Promise<ChannelVideo[]> {
  const channelUrl = `https://www.youtube.com/@${def.handle}`;
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${def.channelId}`,
      { next: { revalidate: 3600 } } // 1 hour
    );
    if (!res.ok) return [];
    const xml = await res.text();

    // Channel display name is the first <title> before the first <entry>.
    const head = xml.split("<entry>")[0];
    const channelName = decodeEntities(firstMatch(head, /<title>([\s\S]*?)<\/title>/) ?? def.handle);

    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    return entries.slice(0, limit).map((e) => {
      const videoId = firstMatch(e, /<yt:videoId>(.*?)<\/yt:videoId>/);
      const title = decodeEntities(firstMatch(e, /<title>([\s\S]*?)<\/title>/) ?? "");
      const published = firstMatch(e, /<published>(.*?)<\/published>/);
      return {
        channelName,
        handle: def.handle,
        channelUrl,
        videoId,
        title: title || null,
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        published,
        thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetch the single latest video for every configured channel (in parallel).
 * Always returns one entry per channel (null fields if none found) — this is
 * the shape /api/youtube and the mobile app consume.
 */
export async function fetchLatestVideos(): Promise<ChannelVideo[]> {
  const perChannel = await Promise.all(CHANNELS.map((c) => fetchChannelVideos(c, 1)));
  return CHANNELS.map((c, i) => perChannel[i][0] ?? {
    channelName: c.handle,
    handle: c.handle,
    channelUrl: `https://www.youtube.com/@${c.handle}`,
    videoId: null, title: null, url: null, published: null, thumbnail: null,
  });
}

/** Fetch the `perChannel` most-recent videos for every channel, flattened. */
export async function fetchRecentVideos(perChannel = 2): Promise<ChannelVideo[]> {
  const results = await Promise.all(CHANNELS.map((c) => fetchChannelVideos(c, perChannel)));
  return results.flat();
}
