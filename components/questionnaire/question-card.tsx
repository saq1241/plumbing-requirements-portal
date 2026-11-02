"use client"

import { Check, Circle, RotateCcw } from "lucide-react"
import type { AnswerRecord } from "@/lib/questionnaire/answer-state"
import { getRecommendedOptions } from "@/lib/questionnaire/resolver"
import type { QuestionnaireClientSpecification, QuestionnaireQuestion } from "@/lib/questionnaire/types"
import { WireframeExample } from "./wireframe-example"

type QuestionCardProps = {
  spec: QuestionnaireClientSpecification
  question: QuestionnaireQuestion
  index: number
  record?: AnswerRecord
  onOption(option: string, selected: boolean): void
  onFreeText(value: string): void
  onNote(value: string): void
  onClear(): void
}

export function QuestionCard({
  spec,
  question,
  index,
  record,
  onOption,
  onFreeText,
  onNote,
  onClear,
}: QuestionCardProps) {
  const recommended = getRecommendedOptions(spec, question)
  const selectedValues = record?.answer?.kind === "multiple"
    ? record.answer.values
    : record?.answer?.kind === "single"
      ? [record.answer.value]
      : []
  const freeText = record?.answer?.kind === "text" ? record.answer.value : ""
  const hasAnswer = selectedValues.length > 0 || freeText.length > 0
  const wireframe = question.wf
    ? spec.wireframes.list.find((item) => Object.hasOwn(item, question.wf!))
    : undefined

  return (
    <article className="question-panel">
      <div className="flex items-start gap-3">
        <span className="question-index mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold">
          {index.toString().padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="question-id">{question.id}</span>
            {question.multi && <span className="multi-badge rounded-full px-2.5 py-1 text-[11px] font-semibold">Choose all that apply</span>}
          </div>
          <h2 className="question-prompt mt-2">{question.q}</h2>
        </div>
      </div>

      {question.note && (
        <aside className="helper-panel mt-4 rounded-r-xl border-l-2 px-4 py-3 text-sm leading-6 sm:ml-11">
          {question.note}
        </aside>
      )}

      <div className="mt-5 space-y-2.5 sm:ml-11" role="group" aria-label={`${question.id} answer options`}>
        {question.opts.map((option) => {
          const selected = selectedValues.includes(option)
          const isRecommended = recommended.includes(option)
          return (
            <button
              key={option}
              type="button"
              className="option-button flex items-start gap-3"
              aria-pressed={selected}
              onClick={() => onOption(option, !selected)}
            >
              <span className="selection-indicator mt-1" aria-hidden="true">
                {selected ? question.multi ? <Check size={13} strokeWidth={2.5} /> : <Circle size={8} fill="currentColor" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block whitespace-normal break-words text-base leading-6">{option}</span>
                {isRecommended && <span className="suggested-badge mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]">Suggested</span>}
              </span>
            </button>
          )
        })}
      </div>

      {!question.gating && (
        <div className="mt-5 space-y-4 sm:ml-11">
          <div>
            <label htmlFor={`${question.id}-write-in`} className="mb-2 block text-sm font-semibold text-plum">Your own answer (optional)</label>
            <textarea
              id={`${question.id}-write-in`}
              className="answer-field min-h-20 resize-y"
              rows={2}
              maxLength={2000}
              value={freeText}
              onChange={(event) => onFreeText(event.target.value)}
              placeholder="Add your answer if none of these choices fit"
            />
          </div>
          <div>
            <label htmlFor={`${question.id}-note`} className="mb-2 block text-sm font-semibold text-plum">Is there anything else you want to tell us? <span className="font-normal text-ink-muted">Optional</span></label>
            <textarea
              id={`${question.id}-note`}
              className="answer-field min-h-20 resize-y"
              rows={2}
              maxLength={2000}
              value={record?.note ?? ""}
              onChange={(event) => onNote(event.target.value)}
              placeholder="Add a little more detail, if you like"
            />
          </div>
          {hasAnswer && (
            <button type="button" onClick={onClear} className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-ink-muted hover:text-royal">
              <RotateCcw size={14} aria-hidden="true" /> Clear answer
            </button>
          )}
        </div>
      )}

      {question.gating && hasAnswer && (
        <div className="mt-4 sm:ml-11">
          <button type="button" onClick={onClear} className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-ink-muted hover:text-royal">
            <RotateCcw size={14} aria-hidden="true" /> Clear selection
          </button>
        </div>
      )}

      {question.wf && <div className="sm:ml-11"><WireframeExample reference={question.wf} entry={wireframe} /></div>}
    </article>
  )
}
