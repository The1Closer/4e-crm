'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import JobsStageRail from '@/components/jobs/JobsStageRail'
import { supabase } from '@/lib/supabase'
import { getCurrentUserProfile, isManagerLike } from '@/lib/auth-helpers'
import { getStageColor, normalizeStageName } from '@/lib/job-stage-access'
import {
  getGeocodeCache,
  loadGoogleMapsApi,
  setGeocodeCache,
  type GoogleGeocoderInstance,
  type GoogleLatLngLiteral,
  type GoogleMapInstance,
  type GoogleMapsNamespace,
  type GoogleMarkerInstance,
} from '@/lib/google-maps'
import { isArchivedByInactivity } from '@/lib/job-lifecycle'

type JobRep = {
  profile_id: string
  profiles:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

type JobRow = {
  id: string
  claim_number: string | null
  insurance_carrier: string | null
  install_date: string | null
  updated_at: string | null
  homeowners:
    | {
        name: string | null
        address: string | null
      }
    | {
        name: string | null
        address: string | null
      }[]
    | null
  pipeline_stages:
    | {
        id?: number | null
        name: string | null
        sort_order?: number | null
      }
    | {
        id?: number | null
        name: string | null
        sort_order?: number | null
      }[]
    | null
  job_reps: JobRep[] | null
}

type AssignedJobRef = {
  job_id: string
}

type GeocodedLead = {
  id: string
  homeownerName: string
  address: string
  claimNumber: string
  insuranceCarrier: string
  stageName: string
  stageSortOrder: number | null
  installDate: string | null
  repNames: string[]
  position: GoogleLatLngLiteral
}

type FailedGeocodeLead = {
  id: string
  homeownerName: string
  address: string
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const EXTERNAL_INSTALL_MAP_URL = process.env.NEXT_PUBLIC_EXTERNAL_INSTALL_MAP_URL ?? ''

function normalizeExternalMapUrl(value: string): string | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  try {
    const parsedUrl = new URL(trimmedValue)

    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return parsedUrl.toString()
    }
  } catch {
    return null
  }

  return null
}

function getHomeowner(
  homeowner: JobRow['homeowners']
): {
  name: string | null
  address: string | null
} | null {
  if (!homeowner) return null
  return Array.isArray(homeowner) ? homeowner[0] ?? null : homeowner
}

function getStageName(stage: JobRow['pipeline_stages']) {
  if (!stage) return 'No Stage'
  const item = Array.isArray(stage) ? stage[0] ?? null : stage
  return item?.name ?? 'No Stage'
}

function getStageSortOrder(stage: JobRow['pipeline_stages']) {
  if (!stage) return null
  const item = Array.isArray(stage) ? stage[0] ?? null : stage
  return typeof item?.sort_order === 'number' ? item.sort_order : null
}

function getRepNames(jobReps: JobRep[] | null): string[] {
  if (!jobReps || jobReps.length === 0) return []

  return jobReps
    .map((rep) => {
      const profile = Array.isArray(rep.profiles)
        ? rep.profiles[0] ?? null
        : rep.profiles

      return profile?.full_name ?? null
    })
    .filter((name): name is string => Boolean(name))
}

function formatDate(value: string | null) {
  if (!value) return 'No install date'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US')
}

function buildMarkerIcon(mapsApi: GoogleMapsNamespace, color: string, selected: boolean) {
  const stroke = selected ? '#ffffff' : '#111111'
  const strokeWidth = selected ? 2.25 : 1.25

  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <path d="M24 4C16.268 4 10 10.268 10 18c0 11.33 14 26 14 26s14-14.67 14-26C38 10.268 31.732 4 24 4Z" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" />
      <circle cx="24" cy="18" r="6.5" fill="#ffffff" fill-opacity="0.92" />
    </svg>
  `)

  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new mapsApi.Size(40, 40),
  }
}

function geocodeAddress(geocoder: GoogleGeocoderInstance, address: string) {
  return new Promise<GoogleLatLngLiteral>((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) {
        reject(new Error(`Geocoding failed for ${address}.`))
        return
      }

      const { location } = results[0].geometry

      resolve({
        lat: location.lat(),
        lng: location.lng(),
      })
    })
  })
}

function LeadMapPageContent() {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null)
  const markerRefs = useRef<GoogleMarkerInstance[]>([])

  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMap, setLoadingMap] = useState(true)
  const [mapsApi, setMapsApi] = useState<GoogleMapsNamespace | null>(null)
  const [pageMessage, setPageMessage] = useState('')
  const [mapMessage, setMapMessage] = useState('')
  const [search, setSearch] = useState('')
  const [stageFilters, setStageFilters] = useState<string[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [geocodedLeads, setGeocodedLeads] = useState<GeocodedLead[]>([])
  const [failedGeocodes, setFailedGeocodes] = useState<FailedGeocodeLead[]>([])
  const [geocodingProgress, setGeocodingProgress] = useState({
    resolved: 0,
    total: 0,
  })
  const externalInstallMapUrl = useMemo(
    () => normalizeExternalMapUrl(EXTERNAL_INSTALL_MAP_URL),
    []
  )

  useEffect(() => {
    let isActive = true

    async function loadJobs() {
      setLoading(true)
      setPageMessage('')

      const currentProfile = await getCurrentUserProfile()

      if (!isActive) return

      if (!currentProfile) {
        setJobs([])
        setLoading(false)
        return
      }

      let visibleJobIds: string[] | null = null

      if (!isManagerLike(currentProfile.role)) {
        const { data: assignedRows, error: assignedError } = await supabase
          .from('job_reps')
          .select('job_id')
          .eq('profile_id', currentProfile.id)

        if (!isActive) return

        if (assignedError) {
          setJobs([])
          setPageMessage(assignedError.message)
          setLoading(false)
          return
        }

        visibleJobIds = [
          ...new Set(
            ((assignedRows ?? []) as AssignedJobRef[]).map((row) => row.job_id)
          ),
        ]

        if (visibleJobIds.length === 0) {
          setJobs([])
          setLoading(false)
          return
        }
      }

      let query = supabase.from('jobs').select(`
        id,
        claim_number,
        insurance_carrier,
        install_date,
        updated_at,
        homeowners (
          name,
          address
        ),
        pipeline_stages (
          id,
          name,
          sort_order
        ),
        job_reps (
          profile_id,
          profiles (
            full_name
          )
        )
      `)

      if (visibleJobIds) {
        query = query.in('id', visibleJobIds)
      }

      const { data, error } = await query

      if (!isActive) return

      if (error) {
        setJobs([])
        setPageMessage(error.message)
        setLoading(false)
        return
      }

      const nextJobs = (data ?? []) as JobRow[]

      setJobs(nextJobs.filter((job) => !isArchivedByInactivity(job.updated_at)))
      setLoading(false)
    }

    void loadJobs()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) {
      setLoadingMap(false)
      return
    }

    let isActive = true

    async function bootMaps() {
      try {
        const api = await loadGoogleMapsApi(GOOGLE_MAPS_KEY)

        if (!isActive) return

        setMapsApi(api)
        setMapMessage('')
      } catch (error) {
        if (!isActive) return
        setMapMessage(
          error instanceof Error ? error.message : 'Failed to initialize Google Maps.'
        )
      } finally {
        if (isActive) {
          setLoadingMap(false)
        }
      }
    }

    void bootMaps()

    return () => {
      isActive = false
    }
  }, [])

  const addressableJobs = useMemo(() => {
    return jobs
      .map((job) => {
        const homeowner = getHomeowner(job.homeowners)
        const address = homeowner?.address?.trim() ?? ''

        if (!address) return null

        return {
          id: job.id,
          homeownerName: homeowner?.name ?? 'Unnamed Homeowner',
          address,
          claimNumber: job.claim_number ?? '-',
          insuranceCarrier: job.insurance_carrier ?? '-',
          stageName: getStageName(job.pipeline_stages),
          stageSortOrder: getStageSortOrder(job.pipeline_stages),
          installDate: job.install_date,
          repNames: getRepNames(job.job_reps),
        }
      })
      .filter((job): job is Omit<GeocodedLead, 'position'> => Boolean(job))
  }, [jobs])

  useEffect(() => {
    if (!mapsApi || addressableJobs.length === 0) {
      setGeocodedLeads([])
      setGeocodingProgress({
        resolved: 0,
        total: addressableJobs.length,
      })
      return
    }

    let isActive = true
    const activeMapsApi = mapsApi

    async function geocodeJobs() {
      const geocoder = new activeMapsApi.Geocoder()
      const nextLeads: GeocodedLead[] = []
      const nextFailedGeocodes: FailedGeocodeLead[] = []
      let resolved = 0

      setGeocodingProgress({
        resolved: 0,
        total: addressableJobs.length,
      })
      setFailedGeocodes([])

      for (const job of addressableJobs) {
        if (!isActive) return

        const cached = getGeocodeCache(job.address)

        if (cached) {
          nextLeads.push({
            ...job,
            position: cached,
          })

          resolved += 1
          setGeocodingProgress({
            resolved,
            total: addressableJobs.length,
          })
          continue
        }

        try {
          const position = await geocodeAddress(geocoder, job.address)
          setGeocodeCache(job.address, position)

          nextLeads.push({
            ...job,
            position,
          })
        } catch (error) {
          console.error(error)
          nextFailedGeocodes.push({
            id: job.id,
            homeownerName: job.homeownerName,
            address: job.address,
          })
        } finally {
          resolved += 1
          setGeocodingProgress({
            resolved,
            total: addressableJobs.length,
          })
        }
      }

      if (!isActive) return

      setGeocodedLeads(nextLeads)
      setFailedGeocodes(nextFailedGeocodes)

      if (!selectedLeadId && nextLeads[0]) {
        setSelectedLeadId(nextLeads[0].id)
      }
    }

    void geocodeJobs()

    return () => {
      isActive = false
    }
  }, [addressableJobs, mapsApi, selectedLeadId])

  useEffect(() => {
    if (!mapsApi || !mapRef.current || mapInstanceRef.current) return

    mapInstanceRef.current = new mapsApi.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        {
          featureType: 'all',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#6b7280' }],
        },
        {
          featureType: 'administrative',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#2d3748' }],
        },
        {
          featureType: 'poi',
          stylers: [{ visibility: 'off' }],
        },
      ],
    })
  }, [mapsApi])

  const filteredLeads = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase()

    return geocodedLeads.filter((lead) => {
      if (stageFilters.length > 0 && !stageFilters.includes(lead.stageName)) {
        return false
      }

      if (!loweredSearch) {
        return true
      }

      return (
        lead.homeownerName.toLowerCase().includes(loweredSearch) ||
        lead.address.toLowerCase().includes(loweredSearch) ||
        lead.claimNumber.toLowerCase().includes(loweredSearch) ||
        lead.insuranceCarrier.toLowerCase().includes(loweredSearch) ||
        lead.repNames.join(' ').toLowerCase().includes(loweredSearch)
      )
    })
  }, [geocodedLeads, search, stageFilters])

  const orderedVisibleStageNames = useMemo(() => {
    const stageMeta = new Map<
      string,
      {
        sortOrder: number | null
        firstSeenIndex: number
      }
    >()

    geocodedLeads.forEach((lead, index) => {
      const existing = stageMeta.get(lead.stageName)

      if (!existing) {
        stageMeta.set(lead.stageName, {
          sortOrder: lead.stageSortOrder,
          firstSeenIndex: index,
        })
        return
      }

      if (
        existing.sortOrder === null &&
        typeof lead.stageSortOrder === 'number'
      ) {
        existing.sortOrder = lead.stageSortOrder
      }
    })

    return Array.from(stageMeta.entries())
      .sort((left, right) => {
        const leftSortOrder = left[1].sortOrder
        const rightSortOrder = right[1].sortOrder

        if (leftSortOrder !== null && rightSortOrder !== null) {
          if (leftSortOrder !== rightSortOrder) {
            return leftSortOrder - rightSortOrder
          }
        } else if (leftSortOrder !== null) {
          return -1
        } else if (rightSortOrder !== null) {
          return 1
        }

        if (left[0] !== right[0]) {
          return left[0].localeCompare(right[0])
        }

        return left[1].firstSeenIndex - right[1].firstSeenIndex
      })
      .map(([stageName]) => stageName)
  }, [geocodedLeads])

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()

    geocodedLeads.forEach((lead) => {
      counts.set(lead.stageName, (counts.get(lead.stageName) ?? 0) + 1)
    })

    return orderedVisibleStageNames
      .map((name) => ({
        name,
        count: counts.get(name) ?? 0,
      }))
      .filter((stage) => stage.count > 0)
  }, [geocodedLeads, orderedVisibleStageNames])

  const getMapStageColor = useCallback(
    (stageName: string) => getStageColor(stageName),
    []
  )

  const selectedLead = useMemo(
    () => filteredLeads.find((lead) => lead.id === selectedLeadId) ?? filteredLeads[0] ?? null,
    [filteredLeads, selectedLeadId]
  )

  useEffect(() => {
    if (!mapsApi || !mapInstanceRef.current) return

    markerRefs.current.forEach((marker) => marker.setMap(null))
    markerRefs.current = []

    if (filteredLeads.length === 0) return

    const bounds = new mapsApi.LatLngBounds()

    filteredLeads.forEach((lead) => {
      const marker = new mapsApi.Marker({
        map: mapInstanceRef.current as GoogleMapInstance,
        position: lead.position,
        title: `${lead.homeownerName} - ${lead.stageName}`,
        icon: buildMarkerIcon(
          mapsApi,
          getMapStageColor(lead.stageName),
          lead.id === selectedLead?.id
        ),
      })

      marker.addListener('click', () => {
        setSelectedLeadId(lead.id)
      })

      markerRefs.current.push(marker)
      bounds.extend(lead.position)
    })

    if (filteredLeads.length === 1) {
      mapInstanceRef.current.setCenter(filteredLeads[0].position)
      mapInstanceRef.current.setZoom(13)
      return
    }

    mapInstanceRef.current.fitBounds(bounds)
  }, [filteredLeads, getMapStageColor, mapsApi, selectedLead])

  const unresolvedAddressCount = addressableJobs.length - geocodedLeads.length

  function toggleStageFilter(stageName: string) {
    setStageFilters((current) =>
      current.includes(stageName)
        ? current.filter((value) => value !== stageName)
        : [...current, stageName]
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Lead Map
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Territory Command Map
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              Google Maps with live color-coded pins for every visible lead that has an address, synced directly to your CRM stage flow.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/jobs"
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              View Jobs
            </Link>
            <Link
              href="/calendar/installs"
              className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
            >
              Open Calendar
            </Link>
            {externalInstallMapUrl ? (
              <a
                href={externalInstallMapUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
              >
                Install Color Map
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MapMetric label="Visible Leads" value={String(jobs.length)} />
        <MapMetric label="Addressable Pins" value={String(geocodedLeads.length)} />
        <MapMetric label="Awaiting Geocode" value={String(Math.max(unresolvedAddressCount, 0))} />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] crm-grid-safe">
          <input
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#d6b37a]/35"
            placeholder="Search homeowner, address, carrier, claim, rep..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
            {geocodingProgress.total > 0
              ? `Geocoding ${geocodingProgress.resolved} of ${geocodingProgress.total} address${geocodingProgress.total === 1 ? '' : 'es'}`
              : 'No addressable leads loaded yet.'}
          </div>
        </div>

        <div className="mt-4">
          <JobsStageRail
            counts={stageCounts}
            activeStages={stageFilters}
            onStageToggle={toggleStageFilter}
            onClearStages={() => setStageFilters([])}
            getStageColorForStage={getMapStageColor}
          />
        </div>
      </section>

      {!GOOGLE_MAPS_KEY ? (
        <section className="rounded-[2rem] border border-amber-400/20 bg-amber-500/10 p-5 text-amber-100 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to your deploy environment to enable the live Google map pins on this page.
        </section>
      ) : null}

      {pageMessage ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/78 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          {pageMessage}
        </section>
      ) : null}

      {failedGeocodes.length > 0 ? (
        <section className="rounded-[2rem] border border-amber-400/20 bg-amber-500/10 p-5 text-amber-100 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/85">
            Unresolved Addresses
          </div>
          <div className="mt-2 text-sm text-amber-100/85">
            {failedGeocodes.length} lead{failedGeocodes.length === 1 ? '' : 's'} could not
            be geocoded, so they do not have map pins yet.
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {failedGeocodes.slice(0, 8).map((lead) => (
              <div
                key={lead.id}
                className="rounded-[1.2rem] border border-amber-300/15 bg-black/15 p-3"
              >
                <div className="text-sm font-semibold text-amber-50">
                  {lead.homeownerName}
                </div>
                <div className="mt-1 text-xs text-amber-100/70">{lead.address}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] crm-grid-safe">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2 pt-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                    Live Map
                  </div>
                  <div className="mt-1 text-sm text-white/62">
                    Pins reflect currently visible, addressable leads.
                  </div>
                </div>

                {loading || loadingMap ? (
                  <div className="text-sm text-white/55">Loading map...</div>
                ) : (
                  <div className="text-sm text-white/55">{filteredLeads.length} visible pins</div>
                )}
              </div>

              <div className="h-[620px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0f0f0f]">
                {!GOOGLE_MAPS_KEY ? (
                  <MapPanelState
                    title="Google Maps key required"
                    description="Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your active environment before loading the live map."
                  />
                ) : mapMessage ? (
                  <MapPanelState
                    title="Google Maps is unavailable"
                    description={mapMessage}
                  />
                ) : (
                  <div
                    ref={mapRef}
                    className="h-full w-full rounded-[1.6rem]"
                  />
                )}
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                  Selected Lead
                </div>

                {!selectedLead ? (
                  <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/14 p-4 text-sm text-white/55">
                    Select a pin to inspect the homeowner and jump into the job.
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="text-xl font-bold tracking-tight text-white">
                        {selectedLead.homeownerName}
                      </div>
                      <div className="mt-1 text-sm text-white/55">
                        {selectedLead.address}
                      </div>
                    </div>

                    <div
                      className="inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                      style={{
                        color: getMapStageColor(selectedLead.stageName),
                        borderColor: `${getMapStageColor(selectedLead.stageName)}55`,
                        backgroundColor: `${getMapStageColor(selectedLead.stageName)}14`,
                      }}
                    >
                      {selectedLead.stageName}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <LeadFact label="Claim" value={selectedLead.claimNumber} />
                      <LeadFact label="Carrier" value={selectedLead.insuranceCarrier} />
                      <LeadFact label="Install" value={formatDate(selectedLead.installDate)} />
                      <LeadFact
                        label="Assignees"
                        value={
                          selectedLead.repNames.length > 0
                            ? selectedLead.repNames.join(', ')
                            : 'No one assigned'
                        }
                      />
                    </div>

                    <Link
                      href={`/jobs/${selectedLead.id}`}
                      className="inline-flex rounded-2xl bg-[#d6b37a] px-4 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
                    >
                      Open Job
                    </Link>
                  </div>
                )}
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                  Visible Leads
                </div>

                <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {filteredLeads.length === 0 ? (
                    <div className="rounded-[1.4rem] border border-dashed border-white/14 p-4 text-sm text-white/55">
                      No leads match the current filters.
                    </div>
                  ) : (
                    filteredLeads.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`w-full rounded-[1.3rem] border p-4 text-left transition ${
                          lead.id === selectedLead?.id
                            ? 'border-[#d6b37a]/35 bg-[#d6b37a]/10'
                            : 'border-white/10 bg-black/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {lead.homeownerName}
                            </div>
                            <div className="mt-1 text-xs text-white/48">
                              {lead.address}
                            </div>
                          </div>

                          <div
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: getMapStageColor(lead.stageName) }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/42">
                          <span>{lead.stageName}</span>
                          <span className="text-white/18">/</span>
                          <span>{normalizeStageName(lead.stageName) ? 'Pinned' : 'Queued'}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </aside>
      </section>
    </div>
  )
}

function MapPanelState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(214,179,122,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 text-center">
      <div className="max-w-lg rounded-[1.6rem] border border-white/10 bg-black/25 px-6 py-7 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
          Map Status
        </div>
        <div className="mt-3 text-xl font-bold tracking-tight text-white">
          {title}
        </div>
        <div className="mt-3 text-sm leading-6 text-white/62">
          {description}
        </div>
      </div>
    </div>
  )
}

function MapMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">
        {value}
      </div>
    </div>
  )
}

function LeadFact({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-white">
        {value}
      </div>
    </div>
  )
}

export default function LeadMapPage() {
  return (
    <ProtectedRoute>
      <LeadMapPageContent />
    </ProtectedRoute>
  )
}
