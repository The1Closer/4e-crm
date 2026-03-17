'use client'

export default function RepMultiSelect({
  reps,
  selectedRepIds,
  onToggle
}:{
  reps:{id:string,full_name:string}[]
  selectedRepIds:string[]
  onToggle:(id:string)=>void
}){

  return(
    <div className="space-y-3">

      <div className="flex flex-wrap gap-3">

        {reps.map(rep=>{

          const selected = selectedRepIds.includes(rep.id)

          return(
            <button
              key={rep.id}
              type="button"
              onClick={()=>onToggle(rep.id)}
              className={`px-4 py-2 rounded-full border text-sm font-semibold transition
              ${selected
                ? "border-[#d6b37a] bg-[#d6b37a]/20 text-[#f2d7a4]"
                : "border-white/10 bg-white/[0.04] text-white hover:border-white/30"}
              `}
            >
              {rep.full_name}
            </button>
          )
        })}

      </div>

    </div>
  )
}
