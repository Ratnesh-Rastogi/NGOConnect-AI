import { ArrowLeft, Leaf, SearchX } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="noise flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg"><Leaf size={25}/></div>
        <div className="mt-10 font-mono text-[11px] font-bold uppercase tracking-[.25em] text-primary">Route not found Â· 404</div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">This path is not on the map.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">The workspace is still here. Try returning to your overview and picking up from there.</p>
        <Link href="/" className="mt-8 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:-translate-y-0.5 hover:shadow-md" data-testid="link-back-overview"><ArrowLeft size={16}/> Back to overview</Link>
        <SearchX className="mx-auto mt-16 text-muted-foreground/30" size={28}/>
      </div>
    </div>
  );
}
