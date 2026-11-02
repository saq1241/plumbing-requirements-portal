"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react"
import {
  addMultiSelectOption,
  clearAnswer,
  createQuestionnaireState,
  getAnswer,
  isQuestionAnswered,
  removeMultiSelectOption,
  setA1Answer,
  setFreeTextAnswer,
  setSingleSelectAnswer,
  updateClientNote,
  type QuestionnaireState,
} from "@/lib/questionnaire/answer-state"
import {
  getFirstApplicableSection,
  getLastApplicableSection,
  goToApplicableSection,
  nextSection,
  previousSection,
} from "@/lib/questionnaire/navigation"
import { calculateQuestionnaireProgress } from "@/lib/questionnaire/progress"
import {
  getGatingQuestion,
  resolveQuestionnaireForTier,
  resolveQuestionnaireFromA1,
} from "@/lib/questionnaire/resolver"
import { prepareSubmission, type PreparedSubmissionPayload } from "@/lib/questionnaire/submission"
import type { QuestionnaireClientSpecification, QuestionnaireQuestion, QuestionnaireRuntimeSpecification, QuestionnaireSection } from "@/lib/questionnaire/types"
import { QuestionCard } from "./question-card"

type JourneyStage = "preparation" | "tier" | "questions" | "review" | "complete"
const journeyVariants = {
  enter: (direction: number) => ({ y: direction > 0 ? 4 : -4 }),
  center: { y: 0 },
  exit: (direction: number) => ({ y: direction > 0 ? -4 : 4 }),
}
const stageContentVariants = {
  enter: { opacity: 0, y: 6 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

type QuestionnaireExperienceProps = {
  spec: QuestionnaireClientSpecification
}

function StageContent({ children, reduceMotion }: { children: ReactNode; reduceMotion: boolean | null }) {
  return (
    <motion.div
      variants={stageContentVariants}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 0.68, 0, 1] }}
    >
      {children}
    </motion.div>
  )
}

function answerLabel(question: QuestionnaireQuestion, state: QuestionnaireState): string {
  const answer = getAnswer(state, question.id)?.answer
  if (!answer) return "Not answered yet"
  if (answer.kind === "text") return answer.value
  if (answer.kind === "multiple") return answer.values.length ? answer.values.join(", ") : "Not answered yet"
  return answer.value
}

function sectionAnswerSummary(section: QuestionnaireSection, state: QuestionnaireState) {
  return section.qs.map((question) => ({
    question,
    value: answerLabel(question, state),
    note: getAnswer(state, question.id)?.note,
    answered: isQuestionAnswered(getAnswer(state, question.id)),
  }))
}

function selectionBadge(spec: QuestionnaireRuntimeSpecification, answer: string | null) {
  if (!answer) return null
  const path = resolveQuestionnaireFromA1(spec, answer)
  if (path.fallbackApplied) return "We’ll use the Ordering App questions for now"
  return path.effectiveTier === 1
    ? "You chose Credit Tracker"
    : path.effectiveTier === 2
      ? "You chose Ordering App"
      : "You chose Full E-commerce + Inventory"
}

function formatTierName(spec: QuestionnaireRuntimeSpecification, tier: number | null) {
  if (tier === null) return "Not selected"
  const entry = Object.entries(spec.scope_tiers).find(([key]) => key.startsWith(`T${tier}_`))
  return entry?.[0].replace(/^T\d+_/, "").replaceAll("_", " ") ?? `Tier ${tier}`
}

export function QuestionnaireExperience({ spec }: QuestionnaireExperienceProps) {
  const [stage, setStage] = useState<JourneyStage>("preparation")
  const [state, setState] = useState<QuestionnaireState>(() => createQuestionnaireState(spec))
  const [prepared, setPrepared] = useState<PreparedSubmissionPayload | null>(null)
  const [message, setMessage] = useState("")
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [confirmingSubmission, setConfirmingSubmission] = useState(false)
  const reduceMotion = useReducedMotion()
  const [transitionDirection, setTransitionDirection] = useState(1)
  const transitionLock = useRef(false)

  const gate = useMemo(() => getGatingQuestion(spec), [spec])
  const sections = useMemo(() => state.effectiveTier === null
    ? []
    : resolveQuestionnaireForTier(spec, state.effectiveTier).sections, [spec, state.effectiveTier])
  const currentSection = sections.find((section) => section.id === state.currentSectionId)
  const progress = calculateQuestionnaireProgress(spec, state)
  const tierResult = resolveQuestionnaireFromA1(spec, state.selectedA1Answer)
  const optionalWireframes = spec.wireframes.list.find((entry) => Array.isArray(entry.also_optional))?.also_optional

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [stage, state.currentSectionId])

  function changeAnswer(question: QuestionnaireQuestion, option: string, selected: boolean) {
    setMessage("")
    setState((current) => {
      if (question.gating) return setA1Answer(spec, current, selected ? option : null)
      if (question.multi) {
        return selected
          ? addMultiSelectOption(spec, current, question.id, option)
          : removeMultiSelectOption(spec, current, question.id, option)
      }
      return selected
        ? setSingleSelectAnswer(spec, current, question.id, option)
        : clearAnswer(spec, current, question.id)
    })
  }

  function navigate(direction: -1 | 1, action: () => void) {
    if (transitionLock.current) return
    transitionLock.current = true
    setTransitionDirection(direction)
    action()
  }

  function commitSubmission() {
    const result = prepareSubmission(spec, state)
    if (!result.ready) {
      setMessage(result.reason === "tier_unresolved"
        ? "Choose the app direction that feels closest before continuing."
        : `Please answer the required items: ${result.questionIds.join(", ")}.`)
      return
    }
    setPrepared(result.payload)
    setStage("complete")
    setMessage("")
  }

  async function copyAnswers() {
    if (!prepared) return
    try {
      await navigator.clipboard.writeText(prepared.summary)
      setMessage("Your answers have been copied.")
    } catch {
      setMessage("Copying is unavailable in this browser. Use the text-file option below.")
    }
  }

  function downloadAnswers() {
    if (!prepared) return
    const file = new Blob([prepared.summary], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(file)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "qontrac-requirements-answers.txt"
    anchor.click()
    URL.revokeObjectURL(url)
    setMessage("Your answer file is ready.")
  }

  async function shareAnswers() {
    if (!prepared) return
    const file = new File([prepared.summary], "qontrac-requirements-answers.txt", { type: "text/plain" })
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ title: "Qontrac Industries — Requirements", files: [file] })
        return
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
      }
    }
    downloadAnswers()
  }

  const whatsAppNumber = spec.backend_spec.owner_whatsapp_number
  const whatsAppDigits = /^\+?[1-9]\d{7,14}$/.test(whatsAppNumber) ? whatsAppNumber.replace("+", "") : null
  const whatsAppTooLong = (prepared?.summary.length ?? 0) > 1800
  const stageKey = stage === "questions" ? `${stage}-${state.currentSectionId}` : stage

  useEffect(() => {
    if (reduceMotion) {
      transitionLock.current = false
    }
  }, [stageKey, reduceMotion])

  return (
    <main className="questionnaire-shell min-h-screen">
      <div className="mx-auto max-w-4xl px-4 pb-8 pt-5 sm:px-7 sm:pt-8">
        <header className="mb-7 flex items-center justify-between gap-4">
          <Link href="/" className="brand-mark" aria-label="Qontrac Industries home">
            <span className="brand-name">QONTRAC <span>INDUSTRIES</span></span>
          </Link>
          <span className="private-badge rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">Private planning</span>
        </header>

        <div className="preview-notice mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm leading-6">
          <ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p><strong>Development preview.</strong> Your answers stay in this browser session only. They are not sent to a server and will clear when you refresh or leave.</p>
        </div>

        {stage !== "complete" && (
          <ProgressHeader
            stage={stage}
            progress={progress}
            section={currentSection}
          />
        )}

        <AnimatePresence
          mode="wait"
          initial={false}
          custom={transitionDirection}
        >
          <motion.div
            key={stageKey}
            custom={transitionDirection}
            variants={journeyVariants}
            initial={reduceMotion ? false : "enter"}
            animate="center"
            exit={reduceMotion ? undefined : "exit"}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.27, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={(definition) => {
              if (definition === "center") transitionLock.current = false
            }}
          >
        {stage === "preparation" && (
          <section className="journey-card mt-6">
            <StageContent reduceMotion={reduceMotion}>
            <p className="eyebrow">Before we begin</p>
            <h1 className="journey-title">{spec.form_spec.start_screen.title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">A few items may make the questions easier. If you don’t have them nearby, that’s okay — you can still continue.</p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {spec.form_spec.start_screen.checklist.map((item) => (
                <li key={item} className="glass-row flex min-h-14 items-center gap-3 rounded-xl px-4 text-base text-plum">
                  <span className="checkmark"><Check size={13} strokeWidth={2.5} aria-hidden="true" /></span>{item}
                </li>
              ))}
            </ul>
            {Array.isArray(optionalWireframes) && optionalWireframes.length > 0 && (
              <details className="glass-row mt-6 rounded-xl px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-royal">More examples</summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {optionalWireframes.map((item) => <span key={item} className="selection-chip rounded-full px-3 py-1.5 text-sm">{item}</span>)}
                </div>
                <p className="mt-2 text-xs leading-5 text-ink-muted">These are ideas only. There are no pictures for them yet.</p>
              </details>
            )}
            <div className="portal-divider mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => setStage("tier")} className="min-h-12 text-sm font-medium text-ink-muted underline-offset-4 hover:text-royal hover:underline">Continue without them</button>
              <button type="button" onClick={() => setStage("tier")} className="primary-button inline-flex min-h-13 items-center justify-center gap-3 px-7 text-sm">I’m ready <ArrowRight size={17} aria-hidden="true" /></button>
            </div>
            </StageContent>
          </section>
        )}

        {stage === "tier" && (
          <section className="questionnaire-main-surface mt-6">
            <StageContent reduceMotion={reduceMotion}>
            <div className="mb-5 px-1">
              <p className="eyebrow">First, choose what you need</p>
              <h1 className="journey-title">There’s no wrong answer.</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">Choose the option that feels closest. You can change it later. It is okay to choose “Not sure”.</p>
            </div>
            <QuestionCard
              spec={spec}
              question={gate}
              index={1}
              record={getAnswer(state, gate.id)}
              onOption={(option, selected) => changeAnswer(gate, option, selected)}
              onFreeText={() => undefined}
              onNote={(note) => setState((current) => updateClientNote(spec, current, gate.id, note))}
              onClear={() => setState((current) => setA1Answer(spec, current, null))}
            />
            {state.selectedA1Answer && tierResult.effectiveTier !== null && (
              <div className="guidance-panel mt-4 flex items-start gap-3 rounded-2xl p-4 text-base leading-6" role="status">
                <HelpCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>{selectionBadge(spec, state.selectedA1Answer)}. We’ll show questions for this choice. Your other answers will stay saved if you change your choice.</p>
              </div>
            )}
            {message && <p className="inline-error mt-4 text-sm font-semibold" role="alert">{message}</p>}
            <div className="portal-divider mt-7 flex items-center justify-between border-t pt-5">
              <button type="button" onClick={() => setStage("preparation")} className="secondary-button"><ArrowLeft size={16} aria-hidden="true" /> Back</button>
              <button
                type="button"
                onClick={() => state.selectedA1Answer ? setStage("questions") : setMessage("Choose one direction to continue. There’s no wrong answer.")}
                className="primary-button inline-flex min-h-13 items-center gap-3 px-7 text-sm"
              >Continue <ArrowRight size={17} aria-hidden="true" /></button>
            </div>
            </StageContent>
          </section>
        )}

        {stage === "questions" && currentSection && (
          <section className="questionnaire-main-surface mt-6">
            <StageContent reduceMotion={reduceMotion}>
            <div className="mb-5 px-1">
              <p className="eyebrow">One section at a time</p>
              <h1 className="journey-title">{currentSection.title}</h1>
              {currentSection.intro && <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">{currentSection.intro}</p>}
              {progress.remainingUnansweredQuestionCount <= 5 && progress.remainingUnansweredQuestionCount > 0 && (
                <p className="mt-3 text-sm font-medium text-royal" role="status">You’re nearly through. Answer anything you feel ready to share.</p>
              )}
              <button type="button" onClick={() => setStage("tier")} className="mt-3 min-h-10 text-sm font-semibold text-royal underline-offset-4 hover:underline">Change your app direction</button>
            </div>
            <div className="space-y-4">
              {currentSection.qs.filter((question) => !question.gating).map((question, index) => (
                <QuestionCard
                  key={question.id}
                  spec={spec}
                  question={question}
                  index={index + 1}
                  record={getAnswer(state, question.id)}
                  onOption={(option, selected) => changeAnswer(question, option, selected)}
                  onFreeText={(value) => setState((current) => setFreeTextAnswer(spec, current, question.id, value))}
                  onNote={(note) => setState((current) => updateClientNote(spec, current, question.id, note))}
                  onClear={() => setState((current) => clearAnswer(spec, current, question.id))}
                />
              ))}
            </div>
            {message && <p className="inline-error mt-4 text-sm font-semibold" role="alert">{message}</p>}
            <div className="floating-nav sticky bottom-3 z-20 mt-7 flex items-center justify-between gap-3 rounded-2xl p-3 sm:static sm:p-0">
              <button
                type="button"
                onClick={() => navigate(-1, () => state.currentSectionId === getFirstApplicableSection(spec, state)
                  ? setStage("tier")
                  : setState((current) => previousSection(spec, current)))}
                className="secondary-button"
              ><ArrowLeft size={16} aria-hidden="true" />Back</button>
              <span className="text-center text-[11px] leading-4 text-ink-muted sm:hidden">You can leave questions blank</span>
              <button
                type="button"
                onClick={() => navigate(1, () => {
                  if (state.currentSectionId === getLastApplicableSection(spec, state)) setStage("review")
                  else setState((current) => nextSection(spec, current))
                })}
                className="primary-button inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm sm:min-h-13 sm:px-7"
              >{state.currentSectionId === getLastApplicableSection(spec, state) ? "Review answers" : "Continue"}<ArrowRight size={16} aria-hidden="true" /></button>
            </div>
            </StageContent>
          </section>
        )}

        {stage === "review" && (
          <section className="questionnaire-main-surface mt-6">
            <StageContent reduceMotion={reduceMotion}>
            <div className="mb-6 px-1">
              <p className="eyebrow">A final look</p>
              <h1 className="journey-title">Review your answers</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">You can go back and make changes. It is okay to leave some questions blank.</p>
            </div>
            <div className="review-direction mb-4 rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-violet">Your choice</p>
                  <p className="mt-2 text-lg font-semibold text-plum">{formatTierName(spec, state.effectiveTier)}</p>
                  {tierResult.fallbackApplied && <p className="mt-1 text-sm text-ink-muted">You chose “{state.selectedA1Answer}”. We’ll use the Ordering App questions and ask you about this later.</p>}
                </div>
                <button type="button" onClick={() => setStage("tier")} className="min-h-10 text-sm font-semibold text-royal underline-offset-4 hover:underline">Change direction</button>
              </div>
            </div>
            <div className="space-y-3">
              {sections.map((section) => {
                const isExpanded = expandedSections.includes(section.id)
                const answers = sectionAnswerSummary(section, state)
                const answeredCount = answers.filter((item) => item.answered).length
                return (
                  <article key={section.id} className="review-section">
                    <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpandedSections((current) => isExpanded ? current.filter((id) => id !== section.id) : [...current, section.id])} aria-expanded={isExpanded}>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">Section {section.id}</span>
                        <span className="mt-1 block truncate text-base font-semibold text-plum">{section.title}</span>
                        <span className="mt-1 block text-sm text-ink-muted">{answeredCount} of {answers.length} answered</span>
                      </button>
                      <button type="button" onClick={() => navigate(-1, () => { setState((current) => goToApplicableSection(spec, current, section.id)); setStage("questions") })} className="secondary-button secondary-button--compact">Edit</button>
                    </div>
                    {isExpanded && (
                      <div className="portal-divider space-y-0 border-t px-4 sm:px-5">
                        {answers.map(({ question, value, note, answered }) => (
                          <div key={question.id} className="portal-divider border-b py-4 last:border-0">
                            <p className="text-sm font-medium leading-5 text-ink-muted">{question.id} · {question.q}</p>
                            <p className={`mt-1 text-base leading-6 ${answered ? "text-plum" : "italic text-ink-muted"}`}>{value}</p>
                            {note && <p className="review-note mt-2 rounded-lg px-3 py-2 text-sm leading-5">Your note: {note}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
            {confirmingSubmission && (
              <section className="confirm-panel mt-5 rounded-2xl p-5" role="alertdialog" aria-labelledby="confirm-submit-title" aria-describedby="confirm-submit-description">
                <h2 id="confirm-submit-title" className="text-base font-semibold text-plum">Ready to finish?</h2>
                <p id="confirm-submit-description" className="mt-2 text-base leading-6 text-ink-muted">We’ll make a summary of your answers. It will stay on this device and will not be sent to Qontrac.</p>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setConfirmingSubmission(false)} className="secondary-button">Go back</button>
                  <button type="button" onClick={commitSubmission} className="primary-button inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm">Confirm finish <CheckCircle2 size={16} aria-hidden="true" /></button>
                </div>
              </section>
            )}
            {message && <p className="inline-error mt-4 text-sm font-semibold" role="alert">{message}</p>}
            <div className="portal-divider mt-7 flex flex-col-reverse items-stretch justify-between gap-3 border-t pt-5 sm:flex-row sm:items-center">
              <button type="button" onClick={() => { const last = sections[sections.length - 1]; if (last) setState((current) => goToApplicableSection(spec, current, last.id)); setConfirmingSubmission(false); setStage("questions") }} className="secondary-button w-full sm:w-auto"><ArrowLeft size={16} aria-hidden="true" /> Back to questions</button>
              <button type="button" onClick={() => setConfirmingSubmission(true)} className="primary-button inline-flex min-h-13 w-full items-center justify-center gap-2 px-6 text-sm sm:w-auto">Finish <CheckCircle2 size={17} aria-hidden="true" /></button>
            </div>
            </StageContent>
          </section>
        )}

        {stage === "complete" && prepared && (
          <section className="journey-card mt-8">
            <StageContent reduceMotion={reduceMotion}>
            <div className="completion-mark mx-auto grid h-14 w-14 place-items-center rounded-full"><CheckCircle2 size={28} strokeWidth={1.7} aria-hidden="true" /></div>
            <p className="eyebrow mt-5 justify-center">Questionnaire complete</p>
            <h1 className="mt-3 text-center text-3xl font-medium tracking-[-0.05em] text-plum sm:text-4xl">Thank you, Qontrac Industries.</h1>
            <p className="mx-auto mt-4 max-w-xl text-center text-base leading-7 text-ink-muted">Your answers are ready. They can help plan an application around the way your business works.</p>
            <div className="glass-surface mt-6 rounded-xl px-4 py-3 text-center text-sm leading-5 text-ink-muted">
              This development preview did not send your answers to a server. They will be cleared when you leave this page.
            </div>
            <div className="mx-auto mt-7 grid max-w-md gap-3 sm:grid-cols-2">
              <button type="button" onClick={copyAnswers} className="secondary-button"><Clipboard size={16} aria-hidden="true" /> Copy answers</button>
              <button type="button" onClick={downloadAnswers} className="secondary-button"><Download size={16} aria-hidden="true" /> Save as text file</button>
              <button type="button" onClick={shareAnswers} className="secondary-button"><FileText size={16} aria-hidden="true" /> Share answer file</button>
              {whatsAppDigits && !whatsAppTooLong && prepared.summary && (
                <a className="secondary-button" href={`https://wa.me/${whatsAppDigits}?text=${encodeURIComponent(prepared.summary)}`} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" /> Send through WhatsApp</a>
              )}
            </div>
            {!whatsAppDigits && <p className="mt-4 text-center text-xs leading-5 text-ink-muted">WhatsApp sharing is not configured yet. You can copy or save your answers instead.</p>}
            {whatsAppDigits && whatsAppTooLong && <p className="mt-4 text-center text-xs leading-5 text-ink-muted">Your answers are too long for one WhatsApp message. Copy or share the answer file instead.</p>}
            {message && <p className="success-text mt-4 text-center text-sm font-medium" role="status">{message}</p>}
            <div className="portal-divider mt-8 flex justify-center border-t pt-6">
              <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-royal hover:underline" onClick={() => { setState(createQuestionnaireState(spec)); setPrepared(null); setExpandedSections([]); setConfirmingSubmission(false); setStage("preparation"); setMessage("") }}><RotateCcw size={15} aria-hidden="true" /> Start a new preview</button>
            </div>
            </StageContent>
          </section>
        )}

          </motion.div>
        </AnimatePresence>

        <footer className="portal-divider mt-10 border-t py-5 text-center text-xs text-ink-muted">
          QONTRAC INDUSTRIES <span className="mx-2 text-ink-muted">·</span> This questionnaire is for planning the future Android application.
        </footer>
      </div>
    </main>
  )
}

type ProgressHeaderProps = {
  stage: JourneyStage
  progress: ReturnType<typeof calculateQuestionnaireProgress>
  section?: QuestionnaireSection
}

function ProgressHeader({ stage, progress, section }: ProgressHeaderProps) {
  const percent = stage === "preparation" ? 0 : stage === "tier" ? 2 : progress.completionPercentage
  const activeLabel = stage === "preparation" ? "Getting ready" : stage === "tier" ? "Choosing your app" : stage === "review" ? "Review" : section?.title ?? "Your questions"
  const activePosition = stage === "preparation" || stage === "tier" ? "Start" : stage === "review" ? "Review" : `Section ${progress.currentSectionPosition ?? 1} of ${progress.totalApplicableSections}`

  return (
    <div className="progress-panel px-4 py-4 sm:px-5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-plum">{activeLabel}</p>
              <p className="mt-1 text-xs text-ink-muted">{activePosition} <span className="mx-1">·</span> You can leave questions blank</p>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-violet">{stage === "questions" ? `${progress.answeredQuestionCount} of ${progress.applicableQuestionCount} answered` : stage === "tier" ? "1 simple choice" : stage === "review" ? "Ready when you are" : "No rush"}</span>
      </div>
      <div className="progress-track mt-3 h-1.5 overflow-hidden rounded-full" role="progressbar" aria-label="Questionnaire progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="progress-fill h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
