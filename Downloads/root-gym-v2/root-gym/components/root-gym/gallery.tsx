'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export function Gallery() {
  const [selected, setSelected] = useState<string | null>(null)

  const photos = [
    { src: '/images/hero-gym.png', label: 'Cardio Zone' },
    { src: '/images/equipment-1.jpg', label: 'Strength Zone' },
    { src: '/images/equipment-2.jpg', label: 'Cable Machines' },
    { src: '/images/group.jpg', label: 'Our Community' },
    { src: '/images/member.jpg', label: 'Members' },
    { src: '/images/exterior.jpg', label: 'Root Gym' },
  ]

  return (
    <section id="gallery" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px flex-1 bg-border max-w-[60px]" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            Inside Root Gym
          </span>
        </div>
        <h2 className="font-heading text-5xl leading-none tracking-tight sm:text-7xl mb-16">
          SEE IT FOR
          <br />
          <span className="text-gold">YOURSELF.</span>
        </h2>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {photos.map((photo, i) => (
            <button
              key={photo.src}
              onClick={() => setSelected(photo.src)}
              className={`relative overflow-hidden rounded-xl bg-card border border-border group cursor-pointer text-left
                ${i === 0 ? 'col-span-2 md:col-span-2 row-span-2' : ''}
              `}
              style={{ minHeight: i === 0 ? '400px' : '180px' }}
            >
              <img
                src={photo.src}
                alt={photo.label}
                className="absolute inset-0 size-full object-cover opacity-80 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-4 text-xs font-bold uppercase tracking-widest text-white/70">
                {photo.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelected(null)}
        >
          <button
            onClick={() => setSelected(null)}
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="size-5" />
          </button>
          <img
            src={selected}
            alt=""
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  )
}