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
    gm_authFailure?: () => void
  }
}

let googleMapsPromise: Promise<GoogleMapsNamespace> | null = null
const GOOGLE_MAPS_CALLBACK = '__fourElementsGoogleMapsInit'
const GOOGLE_MAPS_TIMEOUT_MS = 15000
const GOOGLE_MAPS_AUTH_SETTLE_MS = 250
const GOOGLE_MAPS_LIBRARIES = 'places'
const GEOCODE_CACHE_PREFIX = '4e-crm-geocode::'
const GOOGLE_MAPS_AUTH_FAILURE_MESSAGE =
  'Google Maps rejected this API key. Check billing, allowed site referrers, and the enabled Maps and Places APIs.'

function hasMapsConstructors(
  mapsApi: GoogleMapsNamespace | undefined
): mapsApi is GoogleMapsNamespace {
  return (
    typeof mapsApi?.Map === 'function' &&
    typeof mapsApi?.Marker === 'function' &&
    typeof mapsApi?.Geocoder === 'function'
  )
}

function getGoogleMapsLoaderScript() {
  return document.querySelector<HTMLScriptElement>('script[data-google-maps-loader="true"]')
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

  const existingScript = getGoogleMapsLoaderScript()

  if (existingScript?.dataset.googleMapsAuthFailed === 'true') {
    return Promise.reject(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE))
  }

  if (hasMapsConstructors(window.google?.maps)) {
    return Promise.resolve(window.google.maps)
  }

  if (googleMapsPromise) {
    return googleMapsPromise
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    let settled = false
    let settleId: number | null = null
    const previousAuthFailureHandler = window.gm_authFailure
    let loaderScript = existingScript

    const cleanup = () => {
      if (settleId !== null) {
        window.clearTimeout(settleId)
        settleId = null
      }

      delete window[GOOGLE_MAPS_CALLBACK]

      if (previousAuthFailureHandler) {
        window.gm_authFailure = previousAuthFailureHandler
      } else {
        delete window.gm_authFailure
      }
    }

    const fail = (error: Error) => {
      if (settled) return

      settled = true
      cleanup()
      googleMapsPromise = null
      reject(error)
    }

    const timeoutId = window.setTimeout(() => {
      fail(new Error('Timed out while loading Google Maps.'))
    }, GOOGLE_MAPS_TIMEOUT_MS)

    window.gm_authFailure = () => {
      window.clearTimeout(timeoutId)
      const activeLoaderScript = loaderScript ?? getGoogleMapsLoaderScript()
      if (activeLoaderScript) {
        activeLoaderScript.dataset.googleMapsAuthFailed = 'true'
      }

      try {
        previousAuthFailureHandler?.()
      } catch (error) {
        console.error('Previous Google Maps auth failure handler threw an error.', error)
      }

      fail(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE))
    }

    window[GOOGLE_MAPS_CALLBACK] = () => {
      if (settled) return

      window.clearTimeout(timeoutId)
      settleId = window.setTimeout(() => {
        if (settled) return

        if ((loaderScript ?? getGoogleMapsLoaderScript())?.dataset.googleMapsAuthFailed === 'true') {
          fail(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE))
          return
        }

        if (hasMapsConstructors(window.google?.maps)) {
          settled = true
          cleanup()
          resolve(window.google.maps)
          return
        }

        fail(new Error('Google Maps loaded without exposing the maps API.'))
      }, GOOGLE_MAPS_AUTH_SETTLE_MS)
    }

    const handleScriptError = () => {
      window.clearTimeout(timeoutId)
      fail(new Error('Failed to load Google Maps.'))
    }

    if (existingScript) {
      if (existingScript.dataset.googleMapsAuthFailed === 'true') {
        window.clearTimeout(timeoutId)
        fail(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE))
        return
      }

      if (existingScript.dataset.googleMapsReady === 'true') {
        window.clearTimeout(timeoutId)
        settleId = window.setTimeout(() => {
          if (settled) return

          if (existingScript.dataset.googleMapsAuthFailed === 'true') {
            fail(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE))
            return
          }

          if (hasMapsConstructors(window.google?.maps)) {
            settled = true
            cleanup()
            resolve(window.google.maps)
            return
          }

          fail(new Error('Google Maps loaded without exposing the maps API.'))
        }, GOOGLE_MAPS_AUTH_SETTLE_MS)
        return
      }

      existingScript.addEventListener('error', handleScriptError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly&loading=async&libraries=${GOOGLE_MAPS_LIBRARIES}&callback=${GOOGLE_MAPS_CALLBACK}`
    script.async = true
    script.defer = true
    script.dataset.googleMapsLoader = 'true'
    loaderScript = script

    script.addEventListener('error', handleScriptError, { once: true })

    script.addEventListener('load', () => {
      script.dataset.googleMapsReady = 'true'
    }, { once: true })

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
