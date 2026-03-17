import { redirect } from 'next/navigation'

export default function DashboardBranchRedirectPage() {
  redirect('/dashboard?tab=branch')
}