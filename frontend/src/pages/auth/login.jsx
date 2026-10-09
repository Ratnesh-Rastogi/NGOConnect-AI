import { useState, ArrowRight, Link, useLocation, useLogin, getGetMeQueryKey, queryClient, Button, AuthLayout, Field, InlineError, } from "../../components/common/app-shared";
function LoginPage() {
    const [, setLocation] = useLocation();
    const login = useLogin();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    return <AuthLayout heading="Welcome back" note="Sign in to see what needs moving today."><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); login.mutate({ data: { email, password } }, { onSuccess: (data) => { localStorage.setItem('ngoconnect_token', data.token); queryClient.setQueryData(getGetMeQueryKey(), data.user); setLocation('/'); }, onError: () => undefined }); }}><Field label="Work email"><input required autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organization.org" data-testid="input-email"/></Field><Field label="Password"><input required autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" data-testid="input-password"/></Field>{login.isError && <InlineError message="We could not sign you in. Check your details and try again."/>}<Button className="mt-3 w-full" type="submit" disabled={login.isPending} data-testid="button-login">{login.isPending ? 'Signing inâ€¦' : 'Sign in'}<ArrowRight size={16}/></Button></form><p className="mt-8 text-center text-sm text-muted-foreground">New to NGOConnect? <Link href="/register" className="font-semibold text-primary hover:underline" data-testid="link-register">Create an account</Link></p></AuthLayout>;
}
export default LoginPage;
