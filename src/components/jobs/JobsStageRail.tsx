'use client'

import { getStageColor } from '@/lib/job-stage-access'

export default function JobsStageRail({
  counts,
  activeStages,
  onStageToggle,
  onClearStages,
  allLabel = 'All Stages',
  getStageColorForStage,
}: {
  counts: Array<{ name: string; count: number }>
  activeStages: string[]
  onStageToggle: (stage: string) => void
  onClearStages: () => void
  allLabel?: string
  getStageColorForStage?: (stageName: string) => string
}) {
  return (
    <section className="overflow-x-auto rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="flex min-w-max gap-3">
        <button
          type="button"
          onClick={onClearStages}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
            activeStages.length === 0
              ? 'bg-[#d6b37a] text-black'
              : 'border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]'
          }`}
        >
          {allLabel}
        </button>

        {counts.map((stage) => {
          const isActive = activeStages.includes(stage.name)
          const stageColor = getStageColorForStage
            ? getStageColorForStage(stage.name)
            : getStageColor(stage.name)

          return (
            <button
              key={stage.name}
              type="button"
              onClick={() => onStageToggle(stage.name)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? 'text-white shadow-[0_14px_30px_rgba(0,0,0,0.18)]'
                  : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]'
              }`}
              style={
                isActive
                  ? {
                      borderColor: `${stageColor}66`,
                      backgroundColor: `${stageColor}24`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: stageColor }}
                />
                <div className="text-sm font-semibold">{stage.name}</div>
              </div>
              <div className={`mt-1 text-xs ${isActive ? 'text-white/72' : 'text-white/45'}`}>
                {stage.count} job(s)
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
