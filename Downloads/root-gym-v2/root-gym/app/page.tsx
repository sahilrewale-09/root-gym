import { Navbar } from '@/components/root-gym/navbar'
import { Hero } from '@/components/root-gym/hero'
import { Features } from '@/components/root-gym/features'
import { Equipment } from '@/components/root-gym/equipment'
import { Gallery } from '@/components/root-gym/gallery'
import { Reviews } from '@/components/root-gym/reviews'
import { Contact } from '@/components/root-gym/contact'
import { Footer } from '@/components/root-gym/footer'
import { WhatsAppButton } from '@/components/root-gym/whatsapp-button'

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Gallery />
        <Equipment />
        <Reviews />
        <Contact />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  )
}