import { QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter, Switch, Route, useLocation } from "wouter";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/errors/not-found";
import { queryClient, Shell, getGetMeQueryKey, useGetMe } from "./components/common/app-shared.jsx";
import LoginPage from "./pages/auth/login.jsx";
import RegisterPage from "./pages/auth/register.jsx";
import DashboardPage from "./pages/dashboard/dashboard.jsx";
import ResourcesPage from "./pages/resources/resources.jsx";
import ResourceFormPage from "./pages/resources/resource-form.jsx";
import RequestsPage from "./pages/requests/requests.jsx";
import RequestFormPage from "./pages/requests/request-form.jsx";
import TransactionsPage from "./pages/activity/transactions.jsx";
import RecommendationsPage from "./pages/matching/recommendations.jsx";
import NotificationsPage from "./pages/activity/notifications.jsx";
import AdminPage from "./pages/admin/admin.jsx";
function AppShellRouter() {
    const me = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
    if (me.isLoading)
        return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><div className="w-full max-w-xs space-y-3"><div className="skeleton h-10 w-32 rounded-lg"/><div className="skeleton h-4 w-56 rounded"/><div className="skeleton h-24 rounded-xl"/></div></div>;
    if (me.isError || !me.data)
        return <LoginPage />;
    return <Shell user={me.data}><Switch><Route path="/" component={() => <DashboardPage user={me.data}/>}/><Route path="/resources" component={ResourcesPage}/><Route path="/resources/new" component={ResourceFormPage}/><Route path="/requests" component={RequestsPage}/><Route path="/requests/new" component={RequestFormPage}/><Route path="/transactions" component={TransactionsPage}/><Route path="/recommendations" component={RecommendationsPage}/><Route path="/notifications" component={NotificationsPage}/><Route path="/admin" component={AdminPage}/><Route component={NotFound}/></Switch></Shell>;
}
function Router() {
    const [location] = useLocation();
    return <ErrorBoundary resetKey={location}><Switch><Route path="/login" component={LoginPage}/><Route path="/register" component={RegisterPage}/><Route component={AppShellRouter}/></Switch></ErrorBoundary>;
}
function App() {
    return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
