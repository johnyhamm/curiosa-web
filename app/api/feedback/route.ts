import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_FEEDBACK_TOKEN ?? "";
const GITHUB_REPO  = "johnyhamm/curiosa-web";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      type: "bug" | "feature";
      title: string;
      description: string;
      pageUrl?: string;
    };

    const { type, title, description, pageUrl } = body;

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: "Title and description are required." },
        { status: 400 }
      );
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: "Feedback is not configured yet — please try again later." },
        { status: 503 }
      );
    }

    const isBug    = type === "bug";
    const label    = isBug ? "bug" : "enhancement";
    const emoji    = isBug ? "🐛" : "✨";
    const issueTitle = `${emoji} ${title.trim()}`;

    const lines: string[] = [description.trim()];
    if (pageUrl) lines.push("", "---", `**Page:** ${pageUrl}`);
    const issueBody = lines.join("\n");

    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "SorcerySim/1.0",
        },
        body: JSON.stringify({ title: issueTitle, body: issueBody, labels: [label] }),
      }
    );

    if (!ghRes.ok) {
      const text = await ghRes.text();
      console.error(`[feedback] GitHub API ${ghRes.status}:`, text);
      return NextResponse.json({ error: "Could not create issue." }, { status: 502 });
    }

    const issue = await ghRes.json() as { number: number; html_url: string };
    return NextResponse.json({ issueNumber: issue.number, issueUrl: issue.html_url });
  } catch (err) {
    console.error("[feedback] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
