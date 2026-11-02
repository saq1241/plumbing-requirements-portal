import Link from "next/link"
import { ArrowUpRight, Check, Clock3, ShieldCheck } from "lucide-react"
import { loadQuestionnaireSpecification } from "@/lib/questionnaire/spec-loader"

export const instant = false

export default async function Home() {
  const spec = await loadQuestionnaireSpecification()
  const checklist = spec.form_spec.start_screen.checklist

  return (
    <main className="portal-shell min-h-screen overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between py-6 sm:py-8">
          <a href="#home" className="brand-mark" aria-label="Qontrac Industries home">
            <span className="brand-name">QONTRAC <span>INDUSTRIES</span></span>
          </a>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted sm:block">A private link to help plan your app</span>
        </header>

        <section id="home" className="grid flex-1 items-center gap-12 pb-16 pt-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20 lg:pb-24 lg:pt-12">
          <div className="landing-hero-panel relative z-10 max-w-2xl">
            <p className="eyebrow"><span className="eyebrow-dot" /> Made for Qontrac Industries</p>
            <h1 className="mt-7 max-w-[11ch] text-[clamp(2.8rem,7vw,5.7rem)] font-medium leading-[0.98] tracking-[-0.065em] text-plum">
              Let’s talk about how your <span className="serif-accent">business works.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-ink-muted sm:text-lg">
              We’ll ask a few simple questions about your products, customers, orders and payments. Your answers will help us plan an app that works for your business.
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-royal">
              <ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />
              You do not need technical knowledge. If you are not sure, that is okay.
            </p>
            {process.env.NODE_ENV === "development" ? (
              <Link href="/preview" className="primary-button mt-9 inline-flex min-h-14 items-center gap-3 px-7 text-sm sm:text-base">
                Explore the questionnaire <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <div className="glass-surface mt-9 inline-flex min-h-14 items-center rounded-full px-6 text-sm font-medium text-royal">
                Open the private link you received to begin your questionnaire.
              </div>
            )}
            <p className="mt-4 text-xs text-ink-muted">
              {process.env.NODE_ENV === "development" ? "Development preview · Answers stay in memory and clear when you leave." : "Prepared specifically for Qontrac Industries."}
            </p>
          </div>

          <aside className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end" aria-label="What to keep ready">
            <div className="hero-orbit" aria-hidden="true" />
            <div className="preparation-card relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">A little preparation</p>
                <h2 className="journey-title">Things to keep nearby</h2>
                </div>
                <span className="clock-badge"><Clock3 size={18} aria-hidden="true" /></span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-muted">Do not worry if you do not have everything. You can still continue.</p>
              <ul className="mt-7 space-y-3">
                {checklist.map((item) => (
                  <li key={item} className="checklist-item">
                    <span className="checkmark"><Check size={13} strokeWidth={2.5} aria-hidden="true" /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="portal-divider mt-8 border-t pt-5 text-xs leading-5 text-ink-muted">
                Your answers are for planning the future Android application. This portal is not an online shop.
              </div>
            </div>
          </aside>
        </section>

        <footer className="portal-divider flex flex-col gap-2 border-t py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>QONTRAC INDUSTRIES</span>
        </footer>
      </div>
    </main>
  )
}
