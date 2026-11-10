"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect,useRef,useState } from "react";
import { Home,Shirt,Sparkles,Palette,Bookmark,Settings,Menu,X } from "lucide-react";
import { LogoutButton } from "./logout-button";

const links=[{ href:"/dashboard",label:"Dashboard",icon:Home },{ href:"/closet",label:"My Closet",icon:Shirt },{ href:"/stylist",label:"AI Stylist",icon:Sparkles },{ href:"/style-dna",label:"Style DNA",icon:Palette },{ href:"/lookbook",label:"My Lookbook",icon:Bookmark }];
export function Sidebar() {
  const pathname=usePathname();const dialog=useRef<HTMLDialogElement>(null);const previousOverflow=useRef<string | null>(null);const [open,setOpen]=useState(false);
  function close() { dialog.current?.close(); }
  function restoreScroll() { if (previousOverflow.current!==null) { document.body.style.overflow=previousOverflow.current;previousOverflow.current=null; } }
  useEffect(()=>{
    const media=window.matchMedia("(min-width: 768px)");const current=dialog.current;
    const resize=()=>{ if (media.matches) current?.close(); };
    media.addEventListener("change",resize);
    return ()=>{ media.removeEventListener("change",resize);current?.close();restoreScroll(); };
  },[]);
  return <><button type="button" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>{
    if (dialog.current?.open) return;
    previousOverflow.current=document.body.style.overflow;dialog.current?.showModal();document.body.style.overflow="hidden";setOpen(true);
  }} className="fixed left-4 top-4 z-30 rounded-full bg-[#594273] p-3 text-white shadow md:hidden"><Menu className="h-5 w-5" /></button>
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col overflow-y-auto border-r border-[#ebe7e7] bg-[#fdfcfb] p-7 md:flex"><Navigation pathname={pathname} /></aside>
    <dialog id="mobile-navigation" ref={dialog} aria-label="Main navigation" onClose={()=>{ restoreScroll();setOpen(false); }} onClick={event=>{ if (event.target===event.currentTarget) close(); }} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] overflow-y-auto rounded-r-3xl border-0 bg-[#fdfcfb] p-7 text-[#28262b] shadow-2xl backdrop:bg-[#28262b]/40 backdrop:backdrop-blur-sm md:hidden"><div className="flex min-h-full flex-col"><Navigation pathname={pathname} onNavigate={close} onClose={close} /></div></dialog>
  </>;
}
function Navigation({ pathname,onNavigate,onClose }: { pathname:string;onNavigate?:()=>void;onClose?:()=>void }) {
  return <><div className="flex items-center justify-between"><Link href="/dashboard" onClick={onNavigate} className="serif text-3xl">outfyt<span className="text-[#a69ac5]">.</span></Link>{onClose && <button type="button" onClick={onClose} aria-label="Close navigation" className="rounded-full p-2 text-[#594273] hover:bg-[#eee9f4]"><X className="h-5 w-5" /></button>}</div><p className="mb-9 mt-2 text-xs uppercase tracking-[.16em] text-[#8a759d]">your personal styling studio</p><nav aria-label="Studio" className="space-y-1">{links.map(({ href,label,icon:Icon })=><Link key={href} href={href} aria-current={pathname===href ? "page" : undefined} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${pathname===href ? "bg-[#eee9f4] font-semibold text-[#594273]" : "text-[#756e78] hover:bg-[#f4f0f5]"}`}><Icon aria-hidden="true" className="h-[18px] w-[18px]" />{label}</Link>)}</nav><div className="mt-auto space-y-1 border-t border-[#ebe7e7] pt-5"><Link href="/settings" aria-current={pathname==="/settings" ? "page" : undefined} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${pathname==="/settings" ? "bg-[#eee9f4] font-semibold text-[#594273]" : "text-[#756e78] hover:bg-[#f4f0f5]"}`}><Settings aria-hidden="true" className="h-[18px] w-[18px]" />Settings</Link><LogoutButton /></div></>;
}
