import { redirect } from 'next/navigation'

export default function DashboardTeamRedirectPage() {
  redirect('/dashboard?tab=team')
}