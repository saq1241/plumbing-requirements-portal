import { ArrowLeft, LockKeyhole } from "lucide-react"
import Link from "next/link"

/** Generic response until the server-side private-token persistence adapter is integrated. */
export default function PrivateQuestionnaireLinkPage() {
  return (
    <main className="portal-shell grid min-h-screen place-items-center px-5 py-12">
      <section className="invalid-link-card w-full max-w-lg text-center sm:p-10">
        <div className="completion-mark mx-auto grid h-12 w-12 place-items-center rounded-full"><LockKeyhole size={21} aria-hidden="true" /></div>
        <p className="eyebrow mt-5 justify-center">QONTRAC INDUSTRIES</p>
        <h1 className="mt-3 text-2xl font-medium tracking-[-0.04em] text-plum">This questionnaire link is not working.</h1>
        <p className="mt-3 text-base leading-7 text-ink-muted">Check that you copied the full link. If it still does not work, ask the person who sent it to you for help.</p>
        <Link href="/" className="secondary-button mt-6"><ArrowLeft size={15} aria-hidden="true" /> Back to Qontrac</Link>
      </section>
    </main>
  )
}
