'use client'

import { useEffect, useEffectEvent, useRef } from 'react'
import {
  loadGoogleMapsApi,
  setGeocodeCache,
  type GooglePlaceResult,
  type GooglePlacesAutocompleteInstance,
} from '@/lib/google-maps'
import { cn } from '@/lib/utils'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

const DEFAULT_INPUT_CLASS_NAME =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35 disabled:cursor-not-allowed disabled:opacity-60'

function getAddressValue(place: GooglePlaceResult, fallbackValue: string) {
  return place.formatted_address?.trim() || fallbackValue.trim()
}

export default function AddressAutocompleteInput({
  value,
  onChange,
  placeholder = 'Street address',
  disabled = false,
  className,
  id,
  name,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  name?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const autocompleteRef = useRef<GooglePlacesAutocompleteInstance | null>(null)

  const handlePlaceChanged = useEffectEvent(
    (autocomplete: GooglePlacesAutocompleteInstance) => {
      const place = autocomplete.getPlace()
      const fallbackValue = inputRef.current?.value ?? value
      const nextAddress = getAddressValue(place, fallbackValue)

      onChange(nextAddress)

      const location = place.geometry?.location

      if (nextAddress && location) {
        setGeocodeCache(nextAddress, {
          lat: location.lat(),
          lng: location.lng(),
        })
      }
    }
  )

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !inputRef.current || autocompleteRef.current) return

    let isActive = true

    async function initializeAutocomplete() {
      try {
        const mapsApi = await loadGoogleMapsApi(GOOGLE_MAPS_KEY)

        if (!isActive || !inputRef.current || autocompleteRef.current) return

        const Autocomplete = mapsApi.places?.Autocomplete

        if (!Autocomplete) {
          throw new Error('Google Places autocomplete is unavailable for the address field.')
        }

        const autocomplete = new Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry', 'name', 'place_id'],
          types: ['address'],
        })

        autocomplete.addListener('place_changed', () => {
          handlePlaceChanged(autocomplete)
        })

        autocompleteRef.current = autocomplete
      } catch (error) {
        console.error('Failed to initialize Google address autocomplete.', error)
      }
    }

    void initializeAutocomplete()

    return () => {
      isActive = false
    }
  }, [])

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      value={value}
      disabled={disabled}
      autoComplete="street-address"
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(DEFAULT_INPUT_CLASS_NAME, className)}
    />
  )
}
