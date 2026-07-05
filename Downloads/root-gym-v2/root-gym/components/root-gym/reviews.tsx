import { Star } from 'lucide-react'
import { MAPS_URL } from '@/lib/site'

const REVIEWS = [
  {
    text: "Perfect workout place if you are serious about your health. Management and staff is very good.",
    author: "Captain's Gym Member",
    rating: 5,
  },
  {
    text: "Very good environment to grow. Friendly staff, best equipments. Cleanliness is their first priority. Must recommended.",
    author: 'Suryansh Yadav',
    rating: 5,
  },
  {
    text: "All equipment needed for workout, good trainers, management staff creates a good atmosphere and interacts in a friendly way.",
    author: 'Roshan Mali',
    rating: 5,
  },
]

export function Reviews() {
  return (
    <section id="reviews" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4">

        <div className="flex items-center gap-4 mb-6">
          <div className="h-px flex-1 bg-border max-w-[60px]" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Reviews</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-16">
          <h2 className="font-heading text-5xl leading-none tracking-tight sm:text-7xl">
            WHAT MEMBERS<br />
            <span className="text-gold">ARE SAYING.</span>
          </h2>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg border-2 border-white/20 px-6 py-3 text-sm font-black uppercase tracking-wide text-white transition-all hover:border-gold hover:text-gold shrink-0"
          >
            All 100 Reviews ↗
          </a>
        </div>

        {/* Big rating display */}
        <div className="mb-12 flex items-center gap-5 rounded-xl border border-border bg-card p-6">
          <div className="font-heading text-6xl text-gold leading-none">4.5</div>
          <div>
            <div className="flex gap-1 mb-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`size-5 ${i < 4 ? 'fill-gold text-gold' : 'fill-gold/40 text-gold/40'}`} />
              ))}
            </div>
            <div className="text-sm text-white/50 font-medium">Based on 100 Google Reviews</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <figure
              key={r.author}
              className="flex flex-col rounded-xl border border-border bg-card p-7 hover:border-gold/40 transition-colors"
            >
              <div className="flex gap-0.5 mb-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-gold text-gold" />
                ))}
              </div>
              <blockquote className="grow text-white/60 leading-relaxed text-[15px]">
                "{r.text}"
              </blockquote>
              <figcaption className="mt-6 font-bold text-white text-sm">
                — {r.author}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
