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

export type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMapInstance
  Marker: new (options: GoogleMarkerOptions) => GoogleMarkerInstance
  Geocoder: new () => GoogleGeocoderInstance
  LatLngBounds: new () => GoogleLatLngBoundsInstance
  Size: new (width: number, height: number) => GoogleSizeInstance
}

declare global {
  interface Window {
    google?: {
      maps: GoogleMapsNamespace
    }
  }
}

let googleMapsPromise: Promise<GoogleMapsNamespace> | null = null

export function loadGoogleMapsApi(apiKey: string) {
  if (!apiKey) {
    return Promise.reject(
      new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the lead map.')
    )
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps)
  }

  if (googleMapsPromise) {
    return googleMapsPromise
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-loader="true"]'
    )

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) {
          resolve(window.google.maps)
          return
        }

        reject(new Error('Google Maps loaded without exposing the maps API.'))
      })

      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Google Maps.'))
      })

      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly&loading=async`
    script.async = true
    script.defer = true
    script.dataset.googleMapsLoader = 'true'

    script.addEventListener('load', () => {
      if (window.google?.maps) {
        resolve(window.google.maps)
        return
      }

      reject(new Error('Google Maps loaded without exposing the maps API.'))
    })

    script.addEventListener('error', () => {
      reject(new Error('Failed to load Google Maps.'))
    })

    document.head.appendChild(script)
  })

  return googleMapsPromise
}
