import ProtectedRoute from '@/components/ProtectedRoute'
import JobDetailPageClient from './JobDetailPageClient'

type JobPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function JobDetailPage({ params }: JobPageProps) {
  const { id: jobId } = await params

  return (
    <ProtectedRoute>
      <JobDetailPageClient jobId={jobId} />
    </ProtectedRoute>
  )
}
