import { Heart, MessageCircle, Repeat2, Share } from "lucide-react";
import AdCard from "./AdCard";

export default function HeroSection({ posts, ads = [] }) {
  const mixedFeed = [];
  let adIndex = 0;

  posts.forEach((post, i) => {
    mixedFeed.push({ type: "post", data: post });
    if ((i + 1) % 5 === 3 && adIndex < ads.length) {
      mixedFeed.push({ type: "ad", data: ads[adIndex++] });
    }
  });

  return (
    <section className="mr-4 border-r border-white/10">
      <div className="sticky top-0 z-20 bg-[#06070a]">
        <div className="flex items-center justify-between px-5 py-4">
          <h1 className="text-3xl font-semibold text-white">Home</h1>
          <button
            type="button"
            className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white"
          >
            Post
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-white/10">
          <button type="button" className="border-b-2 border-indigo-600 px-4 py-3 text-sm font-semibold text-white">
            For you
          </button>
          <button type="button" className="px-4 py-3 text-sm font-semibold text-zinc-500">
            Following
          </button>
        </div>
      </div>

      <div id="vista-content-zone">
        {mixedFeed.map((item, i) =>
          item.type === "ad" ? (
            <AdCard key={`ad-${item.data.id}`} campaign={item.data} />
          ) : (
            <article key={`${item.data.handle}-${item.data.timeAgo}-${i}`} className="border-b border-white/10 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-700 text-sm font-bold text-white">
                  {item.data.author.slice(0, 1).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-base text-white">
                    <span className="font-semibold">{item.data.author}</span>
                    <span className="text-zinc-500">{item.data.timeAgo}</span>
                  </p>

                  <p className="mt-1 whitespace-pre-line text-[20px] leading-7 text-zinc-200">{item.data.text}</p>

                  {item.data.media ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                      <div className="h-92.5 w-full bg-linear-to-br from-amber-900/70 via-amber-700/70 to-zinc-700/70" />
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
                    <div className="flex flex-row gap-8">
                      <span className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        {item.data.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Repeat2 className="h-4 w-4" />
                        {item.data.recasts}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        {item.data.replies}
                      </span>
                    </div>
                    <Share className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}
