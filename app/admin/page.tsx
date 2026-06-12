import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getSimStats,
  getRecentAskQuestions,
  getAskQuestionCount,
} from "@/lib/redis";

const ADMIN_EMAIL = "johnyhamm@gmail.com";

export default async function AdminPage() {
  // Protect: must be signed in and be the admin
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  if (email !== ADMIN_EMAIL) redirect("/");

  const [stats, questions, questionCount] = await Promise.all([
    getSimStats(),
    getRecentAskQuestions(75),
    getAskQuestionCount(),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <h1
        className="text-3xl font-bold text-amber-400 mb-8"
        style={{ fontFamily: "var(--font-cinzel)" }}
      >
        Admin
      </h1>

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="All-time sims" value={stats.total} />
        <StatCard label="Today" value={stats.today} />
        <StatCard label="This month" value={stats.thisMonth} />
        <StatCard label="Last 7 days" value={stats.last7Days} />
      </div>

      {/* Daily breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Daily breakdown — last 7 days
        </h2>
        <div className="space-y-2">
          {stats.dailyBreakdown.map(({ date, count }) => {
            const pct = stats.last7Days > 0 ? (count / stats.last7Days) * 100 : 0;
            const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            return (
              <div key={date} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-gray-300 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ask the Sorcerers — recent questions */}
      <div className="mt-10 bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Ask the Sorcerers — recent questions
          </h2>
          <span className="text-xs text-gray-600">
            {questionCount.toLocaleString()} logged
          </span>
        </div>

        {questions.length === 0 ? (
          <p className="text-sm text-gray-600">No questions logged yet.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {questions.map((q, i) => {
              const noContext = q.chunks.length === 0;
              const when = new Date(q.at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <div key={`${q.at}-${i}`} className="py-3 flex flex-col gap-1.5">
                  <div className="flex items-start gap-3">
                    <p className="flex-1 text-sm text-gray-200 leading-snug">{q.q}</p>
                    <span className="text-[11px] text-gray-600 shrink-0 mt-0.5">{when}</span>
                  </div>
                  {noContext ? (
                    <span className="inline-flex items-center gap-1 self-start text-[11px] font-medium
                      text-amber-500 bg-amber-950/40 border border-amber-800/40 rounded-full px-2 py-0.5">
                      ⚠ no context matched
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {q.chunks.map((c, j) => (
                        <span
                          key={j}
                          className="text-[11px] text-gray-400 bg-gray-800 rounded-full px-2 py-0.5"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
      <div className="text-3xl font-bold text-amber-400">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
