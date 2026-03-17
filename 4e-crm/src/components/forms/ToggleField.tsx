'use client'

export default function ToggleField({
  label,
  checked,
  onChange
}:{
  label:string
  checked:boolean
  onChange:(v:boolean)=>void
}){

  return(
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">

      <span className="text-white">{label}</span>

      <button
        type="button"
        onClick={()=>onChange(!checked)}
        className={`w-12 h-6 rounded-full relative transition
          ${checked ? "bg-[#d6b37a]" : "bg-white/20"}
        `}
      >

        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition
          ${checked ? "left-7" : "left-1"}`}
        />

      </button>

    </div>
  )
}
