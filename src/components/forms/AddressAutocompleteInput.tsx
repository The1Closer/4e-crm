'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  type GoogleAutocompletePrediction,
  type GooglePlacesAutocompleteServiceInstance,
  loadGoogleMapsApi,
} from '@/lib/google-maps'
import { cn } from '@/lib/utils'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const MIN_ADDRESS_QUERY_LENGTH = 3
const ADDRESS_SUGGESTION_DEBOUNCE_MS = 180

const DEFAULT_INPUT_CLASS_NAME =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35 disabled:cursor-not-allowed disabled:opacity-60'

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
  const listId = useId()
  const autocompleteServiceRef = useRef<GooglePlacesAutocompleteServiceInstance | null>(null)
  const requestSequenceRef = useRef(0)
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(false)
  const [suggestions, setSuggestions] = useState<GoogleAutocompletePrediction[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) {
      setErrorMessage(
        'Address suggestions are unavailable until the Google Maps API key is configured. You can still enter any address manually.'
      )
      setSuggestionsEnabled(false)
      return
    }

    if (autocompleteServiceRef.current) return

    let isActive = true

    async function initializeAutocompleteService() {
      try {
        const mapsApi = await loadGoogleMapsApi(GOOGLE_MAPS_KEY)

        if (!isActive || autocompleteServiceRef.current) return

        const AutocompleteService = mapsApi.places?.AutocompleteService

        if (!AutocompleteService) {
          throw new Error('Google Places address suggestions are unavailable right now.')
        }

        autocompleteServiceRef.current = new AutocompleteService()
        setSuggestionsEnabled(true)
        setErrorMessage('')
      } catch (error) {
        console.error('Failed to initialize Google address autocomplete.', error)

        if (!isActive) return

        setSuggestionsEnabled(false)
        setErrorMessage(
          error instanceof Error
            ? `${error.message} You can still enter the address manually.`
            : 'Address suggestions are unavailable right now. You can still enter the address manually.'
        )
      }
    }

    void initializeAutocompleteService()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const autocompleteService = autocompleteServiceRef.current
    const normalizedValue = value.trim()

    if (!suggestionsEnabled || !autocompleteService || disabled) {
      setSuggestions([])
      setIsLoadingSuggestions(false)
      return
    }

    if (normalizedValue.length < MIN_ADDRESS_QUERY_LENGTH) {
      setSuggestions([])
      setIsLoadingSuggestions(false)
      return
    }

    const requestSequence = requestSequenceRef.current + 1
    requestSequenceRef.current = requestSequence
    setIsLoadingSuggestions(true)

    const timeoutId = window.setTimeout(() => {
      autocompleteService.getPlacePredictions(
        {
          input: normalizedValue,
          types: ['address'],
        },
        (predictions, status) => {
          if (requestSequenceRef.current !== requestSequence) return

          setIsLoadingSuggestions(false)

          if (status === 'OK') {
            setSuggestions((predictions ?? []).filter((prediction) => prediction.description))
            return
          }

          setSuggestions([])
        }
      )
    }, ADDRESS_SUGGESTION_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [disabled, suggestionsEnabled, value])

  return (
    <div className="space-y-2">
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        disabled={disabled}
        list={suggestionsEnabled ? listId : undefined}
        autoComplete="street-address"
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(DEFAULT_INPUT_CLASS_NAME, className)}
      />

      {suggestionsEnabled ? (
        <datalist id={listId}>
          {suggestions.map((prediction) => (
            <option key={prediction.place_id ?? prediction.description} value={prediction.description} />
          ))}
        </datalist>
      ) : null}

      {suggestionsEnabled ? (
        <div className="text-xs text-white/45">
          {isLoadingSuggestions
            ? 'Loading address suggestions...'
            : 'Choose a suggested address or keep typing your own. Manual entry is always allowed.'}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="text-xs text-amber-200/85">{errorMessage}</div>
      ) : null}
    </div>
  )
}
