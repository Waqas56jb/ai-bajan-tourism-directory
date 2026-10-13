import {
  Activity,
  AlertOctagon,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  FilePlus2,
  FolderTree,
  Gauge,
  HeartPulse,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  MapPin,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';

/**
 * Sidebar navigation. `badge` keys map to live counts computed in the Sidebar
 * (pending submissions, failed sync jobs, new feedback).
 */
export const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true }],
  },
  {
    id: 'directory',
    label: 'Directory Management',
    items: [
      { label: 'All Listings', to: '/listings', icon: Building2, end: true, matchPrefix: ['/listings/lst'] },
      { label: 'Add Listing', to: '/listings/new', icon: FilePlus2 },
      { label: 'Pending Submissions', to: '/listings/submissions', icon: Inbox, badge: 'pending' },
      { label: 'Applications', to: '/listings/applications', icon: ShieldCheck },
      { label: 'Categories', to: '/categories', icon: FolderTree },
      { label: 'Locations', to: '/locations', icon: MapPin },
    ],
  },
  {
    id: 'knowledge',
    label: 'AI Knowledge',
    items: [
      {
        label: 'Knowledge Base',
        to: '/knowledge',
        icon: BookOpen,
        end: true,
        matchPrefix: ['/knowledge/doc', '/knowledge/new'],
      },
      { label: 'FAQs', to: '/knowledge/faqs', icon: HelpCircle },
      { label: 'Knowledge Sync', to: '/knowledge/sync', icon: RefreshCw, badge: 'syncFailed' },
    ],
  },
  {
    id: 'assistant',
    label: 'AI Assistant',
    items: [
      { label: 'Chatbot Overview', to: '/chatbot', icon: Bot, end: true },
      { label: 'Conversations', to: '/chatbot/conversations', icon: MessagesSquare },
      { label: 'Chatbot Settings', to: '/chatbot/settings', icon: Sparkles },
    ],
  },
  {
    id: 'monetization',
    label: 'Monetization',
    items: [
      { label: 'Advertisements', to: '/advertising', icon: Megaphone, end: true },
      { label: 'Featured Listings', to: '/advertising/featured', icon: Star },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { label: 'Users', to: '/users', icon: Users },
      { label: 'Administrators', to: '/administrators', icon: ShieldCheck },
      { label: 'Feedback', to: '/feedback', icon: BarChart3, badge: 'feedbackNew' },
      { label: 'Activity Logs', to: '/activity', icon: Activity },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { label: 'System Health', to: '/monitoring/health', icon: HeartPulse },
      { label: 'Error Logs', to: '/monitoring/errors', icon: AlertOctagon },
      { label: 'General Settings', to: '/settings/general', icon: Settings, matchPrefix: ['/settings'] },
    ],
  },
];

export const SETTINGS_NAV = [
  { label: 'General', to: '/settings/general' },
  { label: 'Appearance', to: '/settings/appearance' },
  { label: 'Notifications', to: '/settings/notifications' },
  { label: 'Account', to: '/settings/account' },
];

export const HELP_ICON = Gauge;
