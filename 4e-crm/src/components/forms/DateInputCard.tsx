'use client'

export default function DateInputCard({
  label,
  value,
  onChange
}:{
  label:string
  value:string
  onChange:(value:string)=>void
}){

  return(
    <div className="space-y-2">

      <label className="text-[12px] uppercase tracking-wider text-[#d6b37a] font-semibold">
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
      />

    </div>
  )
}
