import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Award, ChevronRight, Headphones, Quote, Shield, Tag } from 'lucide-react'
import { trackPage } from '../lib/api'
import SEO from '../components/SEO'

const WHY_CHOOSE_US = [
  {
    icon: Tag,
    title: 'Affordability',
    text: 'Enjoy the hottest products at the most competitive prices on the market.',
  },
  {
    icon: Shield,
    title: 'Authenticity',
    text: 'Rest assured that all our products are genuine, legal, and sourced from reputable distributors.',
  },
  {
    icon: Headphones,
    title: 'Customer Support',
    text: 'Our dedicated 24/7 customer service team is ready to assist you with any inquiries or issues. We understand the importance of a timely response and strive to address your concerns promptly.',
  },
]

const TESTIMONIALS = [
  {
    quote:
      "I've been a loyal customer of eSoftware Store for over a year now, and I can confidently say it's my go-to destination for all things software. Plus, their customer support is top-notch, always ready to assist with any queries. Thanks for consistently delivering excellence!",
    name: 'Kingsley Chandler',
    role: 'Environmental Economist',
  },
  {
    quote:
      'As a small business owner, finding reliable software solutions at affordable prices is crucial. eSoftware Store has been a game-changer for me. Fast delivery and excellent support make eSoftware Store my first choice for software procurement. Highly recommended!',
    name: 'Orson Lancaster',
    role: 'Healthcare Social Worker',
  },
]

export default function AboutPage() {
  useEffect(() => {
    trackPage('/about')
  }, [])

  return (
    <div className="pb-16">
      <SEO
        title="About Us"
        description="Learn about eSoftware Store — affordable genuine software licenses, ebooks, and digital products with 24/7 support and a money-back guarantee."
        path="/about"
      />

      <div className="border-b border-store bg-store-subtle">
        <div className="store-container py-3 text-sm text-store-muted">
          <Link to="/" className="hover:text-[#f97316] transition-colors">Home</Link>
          <ChevronRight size={14} className="mx-1 inline align-middle opacity-50" />
          <span className="text-store-heading font-medium">About Us</span>
        </div>
      </div>

      <section className="store-hero store-container mt-8 px-6 py-12 md:px-12 md:py-16">
        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-[#fbbf24]">About Us</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-4xl lg:text-5xl">
            Unbeatable Prices, Exceptional Value
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
            Welcome to eSoftware Store, your premier destination for top-notch digital solutions and unbeatable prices.
          </p>
        </div>
      </section>

      <div className="store-container mt-12 space-y-12 md:mt-16 md:space-y-16">
        <section className="store-card p-6 md:p-10">
          <div className="prose prose-sm max-w-none text-store-body md:prose-base">
            <p className="leading-relaxed">
              Our team is made up of smart people who know a lot about Microsoft and other important computer software.
              We&apos;ve been doing this for a long time! We think every business needs access to the right tools, and
              that&apos;s where we come in. We have special offerings tailored just for you.
            </p>
            <p className="mt-4 leading-relaxed">
              We understand that not everyone is a big business with lots of money. But guess what? You don&apos;t have to
              pay full price for the computer programs you need. We know you want to use the same software as the big
              companies — great tools that make everything easier, but often really expensive.
            </p>
            <p className="mt-4 leading-relaxed font-semibold text-store-heading">
              Here&apos;s a secret: the big companies don&apos;t pay full price for their software, ebooks, and digital
              products — and neither should you.
            </p>
            <p className="mt-4 leading-relaxed">
              It&apos;s super simple. You get the same great programs and ebooks at a lower price.
            </p>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div className="store-card bg-store-primary-muted p-6 md:p-8">
            <div className="mb-4 inline-flex rounded-full bg-[#f97316]/15 p-3 text-[#f97316]">
              <Award size={24} />
            </div>
            <h2 className="text-xl font-extrabold text-store-heading md:text-2xl">Our Mission</h2>
            <p className="mt-4 leading-relaxed text-store-body">
              Our mission is simple yet powerful — to make premium digital products accessible to people across the
              globe at the most affordable prices. We believe in offering a better alternative to mainstream digital
              marketplaces, ensuring that our customers experience a seamless and transparent purchasing process.
            </p>
          </div>

          <div className="store-card p-6 md:p-8">
            <h2 className="text-xl font-extrabold text-store-heading md:text-2xl">Why Choose Us</h2>
            <ul className="mt-6 space-y-6">
              {WHY_CHOOSE_US.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-store-hover text-[#f97316]">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-store-heading">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-store-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="store-card border-[#f97316]/30 bg-gradient-to-br from-store-primary-muted to-store-surface p-6 md:p-10">
          <h2 className="text-xl font-extrabold text-store-heading md:text-2xl">Money-Back Guarantee</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-store-body">
            Your satisfaction is our priority. We offer a money-back guarantee, ensuring that you can shop on eSoftware
            Store with confidence. In the rare event of any issues with your purchase, our customer service team is here
            to assist you promptly.
          </p>
          <p className="mt-4 leading-relaxed text-store-body">
            Thank you for choosing eSoftware Store, your trusted partner for affordable digital ebooks, software licenses,
            and more. Explore our wide range of products and experience a new standard in online digital shopping.
          </p>
          <Link to="/" className="btn-store-primary mt-8 inline-flex">
            Explore our products
          </Link>
        </section>

        <section>
          <h2 className="text-center text-xl font-extrabold text-store-heading md:text-2xl">
            Testimonials for eSoftware Store&apos;s Excellence
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {TESTIMONIALS.map(({ quote, name, role }) => (
              <blockquote key={name} className="store-card relative p-6 md:p-8">
                <Quote size={28} className="text-[#f97316]/30" aria-hidden />
                <p className="mt-4 text-sm leading-relaxed text-store-body md:text-base">&ldquo;{quote}&rdquo;</p>
                <footer className="mt-6 border-t border-store pt-4">
                  <p className="font-bold text-store-heading">{name}</p>
                  <p className="text-sm text-store-muted">{role}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
