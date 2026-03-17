export type GoogleLatLngLiteral = {
  lat: number
  lng: number
}

export type GoogleMarkerIcon = {
  url: string
  scaledSize?: GoogleSizeInstance
}

export type GoogleMapOptions = {
  center: GoogleLatLngLiteral
  zoom: number
  styles?: Array<Record<string, unknown>>
  mapTypeControl?: boolean
  streetViewControl?: boolean
  fullscreenControl?: boolean
}

export type GoogleMarkerOptions = {
  map: GoogleMapInstance
  position: GoogleLatLngLiteral
  title?: string
  icon?: GoogleMarkerIcon
}

export type GoogleGeocoderRequest = {
  address: string
}

export type GoogleGeocoderStatus = 'OK' | 'ZERO_RESULTS' | string

export type GoogleGeocoderResult = {
  formatted_address?: string
  geometry: {
    location: {
      lat: () => number
      lng: () => number
    }
  }
}

export type GooglePlaceResult = {
  formatted_address?: string
  geometry?: {
    location: {
      lat: () => number
      lng: () => number
    }
  }
  name?: string
  place_id?: string
}

export type GoogleMapInstance = {
  fitBounds: (bounds: GoogleLatLngBoundsInstance) => void
  setCenter: (center: GoogleLatLngLiteral) => void
  setZoom: (zoom: number) => void
}

export type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void
  addListener: (eventName: 'click', handler: () => void) => void
}

export type GoogleGeocoderInstance = {
  geocode: (
    request: GoogleGeocoderRequest,
    callback: (
      results: GoogleGeocoderResult[] | null,
      status: GoogleGeocoderStatus
    ) => void
  ) => void
}

export type GoogleLatLngBoundsInstance = {
  extend: (latLng: GoogleLatLngLiteral) => void
}

export type GoogleSizeInstance = unknown

export type GooglePlacesAutocompleteOptions = {
  fields?: string[]
  types?: string[]
}

export type GooglePlacesAutocompleteInstance = {
  addListener: (eventName: 'place_changed', handler: () => void) => void
  getPlace: () => GooglePlaceResult
}

export type GooglePlacesNamespace = {
  Autocomplete: new (
    input: HTMLInputElement,
    options?: GooglePlacesAutocompleteOptions
  ) => GooglePlacesAutocompleteInstance
}

export type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMapInstance
  Marker: new (options: GoogleMarkerOptions) => GoogleMarkerInstance
  Geocoder: new () => GoogleGeocoderInstance
  LatLngBounds: new () => GoogleLatLngBoundsInstance
  Size: new (width: number, height: number) => GoogleSizeInstance
  places?: GooglePlacesNamespace
}

declare global {
  interface Window {
    google?: {
      maps: GoogleMapsNamespace
    }
    __fourElementsGoogleMapsInit?: () => void
  }
}

let googleMapsPromise: Promise<GoogleMapsNamespace> | null = null
const GOOGLE_MAPS_CALLBACK = '__fourElementsGoogleMapsInit'
const GOOGLE_MAPS_TIMEOUT_MS = 15000
const GOOGLE_MAPS_LIBRARIES = 'places'
const GEOCODE_CACHE_PREFIX = '4e-crm-geocode::'

function hasMapsConstructors(
  mapsApi: GoogleMapsNamespace | undefined
): mapsApi is GoogleMapsNamespace {
  return (
    typeof mapsApi?.Map === 'function' &&
    typeof mapsApi?.Marker === 'function' &&
    typeof mapsApi?.Geocoder === 'function'
  )
}

export function loadGoogleMapsApi(apiKey: string) {
  if (!apiKey) {
    return Promise.reject(
      new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for maps and address search.')
    )
  }

  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in the browser.'))
  }

  if (hasMapsConstructors(window.google?.maps)) {
    return Promise.resolve(window.google.maps)
  }

  if (googleMapsPromise) {
    return googleMapsPromise
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const cleanup = () => {
      delete window[GOOGLE_MAPS_CALLBACK]
    }

    const fail = (error: Error) => {
      cleanup()
      googleMapsPromise = null
      reject(error)
    }

    const timeoutId = window.setTimeout(() => {
      fail(new Error('Timed out while loading Google Maps.'))
    }, GOOGLE_MAPS_TIMEOUT_MS)

    window[GOOGLE_MAPS_CALLBACK] = () => {
      window.clearTimeout(timeoutId)

      if (hasMapsConstructors(window.google?.maps)) {
        cleanup()
        resolve(window.google.maps)
        return
      }

      fail(new Error('Google Maps loaded without exposing the maps API.'))
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-loader="true"]'
    )

    if (existingScript) {
      if (existingScript.dataset.googleMapsReady === 'true') {
        window.clearTimeout(timeoutId)
        if (hasMapsConstructors(window.google?.maps)) {
          cleanup()
          resolve(window.google.maps)
          return
        }
      }

      existingScript.addEventListener('error', () => {
        window.clearTimeout(timeoutId)
        fail(new Error('Failed to load Google Maps.'))
      })

      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly&loading=async&libraries=${GOOGLE_MAPS_LIBRARIES}&callback=${GOOGLE_MAPS_CALLBACK}`
    script.async = true
    script.defer = true
    script.dataset.googleMapsLoader = 'true'

    script.addEventListener('error', () => {
      window.clearTimeout(timeoutId)
      fail(new Error('Failed to load Google Maps.'))
    })

    script.addEventListener('load', () => {
      script.dataset.googleMapsReady = 'true'
    })

    document.head.appendChild(script)
  })

  return googleMapsPromise
}

export function getGeocodeCache(address: string) {
  if (typeof window === 'undefined') return null

  const normalizedAddress = address.trim()

  if (!normalizedAddress) return null

  const rawValue = window.localStorage.getItem(
    `${GEOCODE_CACHE_PREFIX}${normalizedAddress}`
  )

  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as GoogleLatLngLiteral

    if (
      typeof parsed.lat === 'number' &&
      Number.isFinite(parsed.lat) &&
      typeof parsed.lng === 'number' &&
      Number.isFinite(parsed.lng)
    ) {
      return parsed
    }
  } catch (error) {
    console.error('Failed to read cached geocode.', error)
  }

  return null
}

export function setGeocodeCache(address: string, position: GoogleLatLngLiteral) {
  if (typeof window === 'undefined') return

  const normalizedAddress = address.trim()

  if (!normalizedAddress) return

  try {
    window.localStorage.setItem(
      `${GEOCODE_CACHE_PREFIX}${normalizedAddress}`,
      JSON.stringify(position)
    )
  } catch (error) {
    console.error('Failed to cache geocode.', error)
  }
}
