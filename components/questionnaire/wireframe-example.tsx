"use client"

import { Eye } from "lucide-react"
import type { WireframeEntry } from "@/lib/questionnaire/types"

type WireframeExampleProps = {
  reference: string
  entry: WireframeEntry | undefined
}

export function WireframeExample({ reference, entry }: WireframeExampleProps) {
  const content = entry?.[reference]
  if (typeof content !== "string") return null

  return (
    <details className="wireframe-accordion mt-4 overflow-hidden rounded-2xl border">
      <summary className="wireframe-trigger flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold marker:hidden">
        <Eye size={16} aria-hidden="true" />
        See example
      </summary>
      <div className="wireframe-divider border-t p-4 sm:p-5">
        <div className="wireframe-frame mx-auto max-w-sm rounded-[1.5rem] border-[5px] p-3">
          <div className="wireframe-divider flex items-center justify-between border-b pb-3">
            <span className="wireframe-brand text-[10px] font-bold uppercase tracking-[0.14em]">Qontrac · sample screen</span>
            <span className="wireframe-line h-1.5 w-8 rounded-full" aria-hidden="true" />
          </div>
          <div className="space-y-3 py-4">
            <div className="wireframe-line h-2 w-2/5 rounded-full" aria-hidden="true" />
            <div className="wireframe-sample rounded-xl border p-3">
              <p className="text-xs leading-5">{content}</p>
            </div>
            <div className="wireframe-line h-2 w-3/5 rounded-full" aria-hidden="true" />
            <div className="wireframe-sample h-9 rounded-lg border" aria-hidden="true" />
          </div>
        </div>
        <p className="mt-3 text-center text-xs font-medium text-ink-muted">Sample only. Final design may differ.</p>
      </div>
    </details>
  )
}
