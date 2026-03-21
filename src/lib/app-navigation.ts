import type { ComponentType } from 'react'
import type { AppPermissions } from '@/lib/auth-helpers'
import {
  Archive,
  Bell,
  BookOpenText,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  PenSquare,
  PlusSquare,
  Settings2,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'

export type AppNavItem = {
  href: string
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
  show: boolean
  group: 'main' | 'workspace' | 'admin' | 'account'
}

export function buildNavigationItems(permissions: AppPermissions): AppNavItem[] {
  return [
    {
      href: '/',
      label: 'Home',
      description: 'Start here for quick links, updates, unread notifications, and your weekly pace.',
      icon: Home,
      show: permissions.canViewHome,
      group: 'main',
    },
    {
      href: '/dashboard',
      label: 'Dashboard',
      description: 'See performance, pipeline health, and reporting in one place.',
      icon: LayoutDashboard,
      show: permissions.canViewDashboard,
      group: 'main',
    },
    {
      href: '/jobs',
      label: 'Jobs',
      description: 'Work the pipeline, homeowner details, files, and internal status updates.',
      icon: Briefcase,
      show: permissions.canViewJobs,
      group: 'workspace',
    },
    {
      href: '/jobs/new',
      label: 'Create Job',
      description: 'Start a new file and assign the right team immediately.',
      icon: PlusSquare,
      show: permissions.canCreateJob,
      group: 'workspace',
    },
    {
      href: '/calendar/installs',
      label: 'Calendar',
      description: 'Schedule installs and move work into install workflow stages.',
      icon: CalendarDays,
      show: permissions.canViewInstallCalendar,
      group: 'workspace',
    },
    {
      href: '/stats/submit',
      label: 'Submit Numbers',
      description: 'Log today’s activity and keep coaching/reporting current.',
      icon: ClipboardList,
      show: true,
      group: 'workspace',
    },
    {
      href: '/map',
      label: 'Lead Map',
      description: 'Work visible homeowner leads on the map.',
      icon: MapPinned,
      show: permissions.canViewLeadMap,
      group: 'workspace',
    },
    {
      href: '/claim-resource-library',
      label: 'Claim Library',
      description: 'Browse claim documents, videos, and photos organized by category.',
      icon: BookOpenText,
      show: permissions.canViewClaimResourceLibrary,
      group: 'workspace',
    },
    {
      href: '/training',
      label: 'Training',
      description: 'Open playbooks, decks, and videos for the team.',
      icon: BookOpenText,
      show: true,
      group: 'workspace',
    },
    {
      href: '/commissions',
      label: 'Commissions',
      description: 'Review payout-ready jobs and commission status.',
      icon: ShieldCheck,
      show: permissions.canViewCommissions,
      group: 'workspace',
    },
    {
      href: '/templates',
      label: 'Templates',
      description: 'Manage the PDFs the team launches into the signer.',
      icon: FileText,
      show: permissions.canViewTemplates,
      group: 'workspace',
    },
    {
      href: '/contracts/editor',
      label: 'Signer',
      description: 'Open, annotate, sign, and save PDFs back into the CRM.',
      icon: PenSquare,
      show: permissions.canUseSigner,
      group: 'workspace',
    },
    {
      href: '/notifications',
      label: 'Notifications',
      description: 'Catch assignments, mentions, stage changes, and archive alerts.',
      icon: Bell,
      show: permissions.canViewNotifications,
      group: 'workspace',
    },
    {
      href: '/team/users',
      label: 'Users',
      description: 'Manage team members, roles, and nightly roster settings.',
      icon: Users,
      show: permissions.canManageUsers,
      group: 'admin',
    },
    {
      href: '/stats/manager',
      label: 'Branch Numbers',
      description: 'Review and edit nightly numbers across the roster.',
      icon: Settings2,
      show: permissions.canViewManagerEntry,
      group: 'admin',
    },
    {
      href: '/updates',
      label: 'Updates',
      description: 'Control the home-page announcements, quotes, and video spotlight.',
      icon: Megaphone,
      show: permissions.canManageHomeContent,
      group: 'admin',
    },
    {
      href: '/profile',
      label: 'Profile',
      description: 'Review your account details and personal settings.',
      icon: UserRound,
      show: true,
      group: 'account',
    },
    {
      href: '/archive',
      label: 'Archive',
      description: 'Browse files that aged into archive status.',
      icon: Archive,
      show: permissions.canViewArchive,
      group: 'account',
    },
  ]
}
