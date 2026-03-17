'use client'

import { useState } from 'react'

export type SearchableOption = {
  value: string
  label: string
}

export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select option"
}:{
  label: string
  value: string
  options: SearchableOption[]
  onChange:(value:string)=>void
  placeholder?:string
}){

  const [search,setSearch] = useState("")

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-2">
      <label className="text-[12px] uppercase tracking-wider text-[#d6b37a] font-semibold">
        {label}
      </label>

      <input
        placeholder="Search..."
        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-white"
        value={search}
        onChange={(e)=>setSearch(e.target.value)}
      />

      <select
        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
        value={value}
        onChange={(e)=>onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>

        {filtered.map(opt=>(
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}

      </select>
    </div>
  )
}
