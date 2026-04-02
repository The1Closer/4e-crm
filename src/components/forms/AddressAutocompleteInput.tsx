'use client'

import { useEffect, useRef, useState } from 'react'
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
const GOOGLE_MAPS_ATTRIBUTION_CLASS_NAME =
  'whitespace-nowrap text-[12px] font-normal tracking-normal text-white/74'

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
  const autocompleteServiceRef = useRef<GooglePlacesAutocompleteServiceInstance | null>(null)
  const requestSequenceRef = useRef(0)
  const blurTimeoutRef = useRef<number | null>(null)
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(false)
  const [suggestions, setSuggestions] = useState<GoogleAutocompletePrediction[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)

  const normalizedValue = value.trim()
  const shouldShowSuggestionList =
    suggestionsEnabled &&
    isInputFocused &&
    normalizedValue.length >= MIN_ADDRESS_QUERY_LENGTH &&
    suggestions.length > 0

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
  }, [disabled, normalizedValue, suggestionsEnabled])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  function handleSuggestionSelect(nextValue: string) {
    onChange(nextValue)
    setIsInputFocused(false)
    setSuggestions([])
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          id={id}
          name={name}
          type="text"
          value={value}
          disabled={disabled}
          autoComplete="street-address"
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current)
              blurTimeoutRef.current = null
            }
            setIsInputFocused(true)
          }}
          onBlur={() => {
            blurTimeoutRef.current = window.setTimeout(() => {
              setIsInputFocused(false)
            }, 120)
          }}
          className={cn(DEFAULT_INPUT_CLASS_NAME, className)}
        />

        {shouldShowSuggestionList ? (
          <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-white/12 bg-[#10151f] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            {suggestions.map((prediction) => (
              <button
                key={prediction.place_id ?? prediction.description}
                type="button"
                onMouseDown={(event) => {
                  // Prevent input blur before click so selection stays reliable on mobile Safari.
                  event.preventDefault()
                }}
                onClick={() => handleSuggestionSelect(prediction.description)}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/85 transition hover:bg-white/10"
              >
                {prediction.description}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {suggestionsEnabled ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
          <div>
            {isLoadingSuggestions
              ? 'Loading address suggestions...'
              : 'Choose a suggested address or keep typing your own. Manual entry is always allowed.'}
          </div>
          <span
            translate="no"
            className={GOOGLE_MAPS_ATTRIBUTION_CLASS_NAME}
          >
            Google Maps
          </span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="text-xs text-amber-200/85">{errorMessage}</div>
      ) : null}
    </div>
  )
}
