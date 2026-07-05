import { MessageCircle } from 'lucide-react'
import { waLink } from '@/lib/site'

export function WhatsAppButton() {
  return (
    <a
      href={waLink(
        "Hi, I'm interested in joining Root Gym Goregaon. Can you share membership details?",
      )}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Root Gym on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg animate-pulse-glow transition-transform hover:scale-105"
    >
      <MessageCircle className="size-7" />
    </a>
  )
}
