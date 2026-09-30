import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Bell, Check, CheckCircle2, CircleAlert, CircleDot, ClipboardList,
  Filter, HandHeart, LayoutDashboard, Leaf, LogOut, Menu, Package, Plus, RefreshCw,
  Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Truck, Users, X, XCircle, Zap,
} from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import {
  useAcceptRequest, useCompleteRequest, useCreateRequest, useCreateResource, useDeleteResource,
  useGetAdminStats, useGetDashboard, useGetMe, useGetRequest, useGetResource, useListNgos, useListNotifications,
  useListRecommendations, useListRequests, useListResources, useListTransactions,
  useLogin, useLogout, useMarkNotificationRead, useRegister, useRejectRequest,
  useUpdateResource, useVerifyNgo,
  getGetAdminStatsQueryKey, getGetDashboardQueryKey, getGetMeQueryKey, getGetRequestQueryKey, getGetResourceQueryKey,
  getListNgosQueryKey, getListNotificationsQueryKey, getListRecommendationsQueryKey,
  getListRequestsQueryKey, getListResourcesQueryKey, getListTransactionsQueryKey,
  setAuthTokenGetter,
  type Resource, type ResourceRequest, type User,
} from '@ngoconnect/api-client';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });

setAuthTokenGetter(() => (typeof localStorage === 'undefined' ? null : localStorage.getItem('ngoconnect_token')));

const categories = ['food', 'medicines', 'healthcare_supplies', 'clothing', 'other'] as const;

const categoryLabel = (value?: string) => (value ?? 'other').replaceAll('_', ' ');

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';

const formatAgo = (value?: string) => value ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round((new Date(value).getTime() - Date.now()) / 86400000), 'day') : 'â€”';

const initials = (name?: string) => (name ?? 'NG').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

const humanStatus = (value?: string) => value ? value.replaceAll('_', ' ') : 'unknown';

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'green' | 'orange' | 'red' | 'blue' | 'muted' }) {
  return <span data-testid="status-badge" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide badge-${tone}`}>{children}</span>;
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'danger' }) {
  return <button {...props} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${variant === 'primary' ? 'bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-md' : variant === 'outline' ? 'border border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted' : variant === 'danger' ? 'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} ${className}`}>{children}</button>;
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div><div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-primary">{eyebrow}</div><h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>{description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action}
  </div>;
}

function StatCard({ label, value, hint, icon: Icon, accent = 'teal' }: { label: string; value?: number | string; hint?: string; icon: React.ElementType; accent?: 'teal' | 'coral' | 'gold' | 'blue' }) {
  return <div className="group rounded-xl border border-card-border bg-card p-4 shadow-[0_2px_10px_hsl(194_30%_15%/.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_hsl(194_30%_15%/.07)]" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="flex items-start justify-between"><span className={`flex size-9 items-center justify-center rounded-lg stat-${accent}`}><Icon size={17}/></span><span className="font-mono text-[10px] text-muted-foreground">LIVE</span></div>
    <div className="mt-4 text-3xl font-bold tracking-tight">{value ?? 'â€”'}</div><div className="mt-1 text-sm font-medium">{label}</div>{hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
  </div>;
}

function SkeletonList({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-3" data-testid="loading-skeleton">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-[68px] rounded-xl" />)}</div>;
}

function EmptyState({ icon: Icon = Package, title, description, action }: { icon?: React.ElementType; title: string; description: string; action?: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-card-border bg-card/60 px-6 py-14 text-center" data-testid="empty-state"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon size={22}/></div><h3 className="mt-4 text-base font-bold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function ErrorState({ retry }: { retry: () => void }) {
  return <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center" data-testid="error-state"><CircleAlert className="mx-auto text-destructive" size={24}/><h3 className="mt-3 font-bold">We could not load this view</h3><p className="mt-1 text-sm text-muted-foreground">The coordination service may be taking a moment.</p><Button className="mt-4" variant="outline" onClick={retry} data-testid="button-retry"><RefreshCw size={15}/> Try again</Button></div>;
}

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/resources', label: 'Resources', icon: Package },
  { href: '/requests', label: 'Requests', icon: ClipboardList },
  { href: '/transactions', label: 'Transactions', icon: Truck },
  { href: '/recommendations', label: 'Recommendations', icon: Sparkles },
  { href: '/notifications', label: 'Notifications', icon: Bell },
];

function Shell({ children, user }: { children: React.ReactNode; user?: User }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useLogout();
  const unread = useListNotifications(undefined, { query: { queryKey: getListNotificationsQueryKey(), enabled: Boolean(user) } });
  const isAdmin = user?.role === 'admin';
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { localStorage.removeItem('ngoconnect_token'); queryClient.clear(); setLocation('/login'); } });
  return <div className="noise flex min-h-[100dvh] bg-background">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-6"><div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Leaf size={19}/></div><div><div className="text-[15px] font-bold tracking-tight">NGOConnect</div><div className="font-mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/55">AI coordination</div></div></div>
      <div className="px-4 pt-6"><div className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/45">Workspace</div>{navItems.map(({ href, label, icon: Icon }) => <Link href={href} key={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase()}`} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${location === href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/68 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground'}`}><Icon size={17}/><span>{label}</span>{label === 'Notifications' && (unread.data?.filter((n) => !n.read).length ?? 0) > 0 && <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-sidebar-primary text-[10px] font-bold text-sidebar-primary-foreground">{unread.data?.filter((n) => !n.read).length}</span>}</Link>)}</div>
      <div className="mt-5 border-t border-sidebar-border px-4 pt-5"><div className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/45">Governance</div>{isAdmin && <Link href="/admin" data-testid="link-nav-admin" className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${location === '/admin' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/68 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground'}`}><ShieldCheck size={17}/> Admin console</Link>}<button data-testid="button-settings" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground/68 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground"><Settings2 size={17}/> Workspace settings</button></div>
      <div className="mt-auto border-t border-sidebar-border p-4"><div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/70 p-3"><div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">{initials(user?.name)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{user?.name ?? 'Workspace member'}</div><div className="truncate text-[11px] capitalize text-sidebar-foreground/55">{user?.role ?? 'member'}</div></div><button onClick={signOut} aria-label="Sign out" data-testid="button-logout" className="text-sidebar-foreground/55 hover:text-sidebar-foreground"><LogOut size={16}/></button></div></div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" data-testid="button-close-menu"/>}
    <main className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md sm:px-8"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-muted lg:hidden" aria-label="Open menu" data-testid="button-open-menu"><Menu size={20}/></button><div className="hidden font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground sm:block">Moving essentials, with clarity</div><div className="ml-auto flex items-center gap-3"><Link href="/notifications" className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Notifications" data-testid="link-header-notifications"><Bell size={18}/>{(unread.data?.filter((n) => !n.read).length ?? 0) > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />}</Link><div className="hidden h-5 w-px bg-border sm:block"/><span className="hidden text-sm font-medium text-muted-foreground sm:block">{user?.name}</span></div></header><div className="page-enter p-5 sm:p-8">{children}</div></main>
  </div>;
}

function AuthLayout({ children, heading, note }: { children: React.ReactNode; heading: string; note: string }) {
  return <div className="noise grid min-h-[100dvh] bg-background lg:grid-cols-[.88fr_1.12fr]"><div className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between"><div className="absolute -right-32 -top-24 size-96 rounded-full border-[42px] border-sidebar-primary/10"/><div className="absolute -bottom-20 -left-20 size-80 rounded-full border-[26px] border-accent/15"/><div className="relative"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Leaf size={20}/></div><div><div className="font-bold">NGOConnect</div><div className="font-mono text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/55">AI coordination</div></div></div><div className="mt-28 max-w-md"><div className="font-mono text-[10px] uppercase tracking-[.2em] text-sidebar-primary">A clearer way forward</div><h2 className="mt-5 text-5xl font-bold leading-[1.02] tracking-[-.04em]">Make every surplus count.</h2><p className="mt-6 max-w-sm text-base leading-7 text-sidebar-foreground/65">A practical workspace for the people moving essentials from where they are to where they matter.</p></div></div><div className="relative flex items-center gap-2 text-xs text-sidebar-foreground/50"><CircleDot size={13} className="text-sidebar-primary"/> Built for accountable action</div></div><div className="flex items-center justify-center p-6 sm:p-10"><div className="w-full max-w-[420px]"><div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Leaf size={18}/></div><div className="font-bold">NGOConnect</div></div></div><div className="mb-8"><div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Welcome</div><h1 className="mt-2 text-3xl font-bold tracking-tight">{heading}</h1><p className="mt-2 text-sm text-muted-foreground">{note}</p></div>{children}</div></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold">{label}<div className="mt-1.5">{children}</div></label>; }

function InlineError({ message }: { message: string }) { return <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" data-testid="status-error"><CircleAlert size={16} className="mt-0.5 shrink-0"/>{message}</div>; }

function FormInput({ value, onChange, placeholder, type = 'text', required = false }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) { return <input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/>; }

function ResourceRow({ resource, action }: { resource: Resource; action?: React.ReactNode }) { return <div className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-3 transition hover:border-border hover:bg-muted/45" data-testid={`row-resource-${resource.id}`}><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><Package size={16}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{resource.name}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{resource.ownerNgoName} Â· {resource.location}</div></div><div className="hidden text-right sm:block"><div className="font-mono text-xs font-bold">{resource.quantity} {resource.unit}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{categoryLabel(resource.category)}</div></div>{action ?? <Badge tone={resource.status === 'available' ? 'green' : 'muted'}>{humanStatus(resource.status)}</Badge>}</div>; }

function RequestMini({ request }: { request: ResourceRequest }) { return <div className="flex items-start gap-3 rounded-lg bg-muted/55 p-3" data-testid={`row-request-${request.id}`}><div className={`mt-1 size-2 rounded-full ${request.urgency === 'critical' ? 'bg-destructive' : request.urgency === 'high' ? 'bg-accent' : 'bg-primary'}`}/><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{request.resourceType}</div><div className="mt-1 text-xs text-muted-foreground">{request.requesterNgoName} Â· {request.quantity} needed</div></div><Badge tone={request.urgency === 'critical' ? 'red' : request.urgency === 'high' ? 'orange' : 'muted'}>{request.urgency}</Badge></div>; }


export {
  useMemo,
  useState,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  ClipboardList,
  Filter,
  HandHeart,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Users,
  X,
  XCircle,
  Zap,
  Link,
  Route,
  Switch,
  WouterRouter,
  useLocation,
  useParams,
  useAcceptRequest,
  useCompleteRequest,
  useCreateRequest,
  useCreateResource,
  useDeleteResource,
  useGetAdminStats,
  useGetDashboard,
  useGetMe,
  useGetRequest,
  useGetResource,
  useListNgos,
  useListNotifications,
  useListRecommendations,
  useListRequests,
  useListResources,
  useListTransactions,
  useLogin,
  useLogout,
  useMarkNotificationRead,
  useRegister,
  useRejectRequest,
  useUpdateResource,
  useVerifyNgo,
  getGetAdminStatsQueryKey,
  getGetDashboardQueryKey,
  getGetMeQueryKey,
  getGetRequestQueryKey,
  getGetResourceQueryKey,
  getListNgosQueryKey,
  getListNotificationsQueryKey,
  getListRecommendationsQueryKey,
  getListRequestsQueryKey,
  getListResourcesQueryKey,
  getListTransactionsQueryKey,
  setAuthTokenGetter,
  Resource,
  ResourceRequest,
  User,
  ErrorBoundary,
  Toaster,
  TooltipProvider,
  NotFound,
  queryClient,
  categories,
  categoryLabel,
  formatDate,
  formatAgo,
  initials,
  humanStatus,
  Badge,
  Button,
  SectionTitle,
  StatCard,
  SkeletonList,
  EmptyState,
  ErrorState,
  navItems,
  Shell,
  AuthLayout,
  Field,
  InlineError,
  FormInput,
  ResourceRow,
  RequestMini
};
