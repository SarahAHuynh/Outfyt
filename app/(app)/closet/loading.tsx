import { AppShell } from "@/components/app-shell";

export default function LoadingCloset() {
  return <AppShell title="My Closet" eyebrow="your pieces, your starting point"><div role="status" aria-label="Loading your closet" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="animate-pulse rounded-2xl bg-white p-3"><div className="aspect-[4/5] rounded-xl bg-[#eee9f4]" /><div className="mt-4 h-4 w-3/4 rounded bg-[#eee9f4]" /></div>)}</div></AppShell>;
}
