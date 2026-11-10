import Link from "next/link";
export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center px-6"><section className="max-w-md text-center"><p className="text-xs font-semibold uppercase tracking-widest text-[#8a759d]">404 · a little off course</p><h1 className="serif mt-4 text-4xl">This page isn’t in your closet.</h1><p className="mt-4 text-sm leading-6 text-[#756e78]">The link may have changed. Head back to your studio to keep styling.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-[#594273] px-5 py-3 text-sm font-semibold text-white hover:bg-[#47345d]">Back to my studio</Link></section></main>;
}
