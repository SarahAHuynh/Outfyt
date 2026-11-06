"use client";
/* eslint-disable @next/next/no-img-element -- Private signed wardrobe URLs. */
import { useState, type ReactNode } from "react";
import { Shirt } from "lucide-react";
import type { WardrobeItem } from "@/lib/wardrobe/schema";

export function OutfitCard({ name,description,explanation,itemIds,wardrobe,footer,ordinal }: { name:string; description:string; explanation?:string; itemIds:string[]; wardrobe:WardrobeItem[]; footer?:ReactNode; ordinal?:number }) {
  return <article className="overflow-hidden rounded-2xl border border-[#e4dce9] bg-white">
    <div className="grid grid-cols-2 gap-2 bg-[#f4f0f7] p-3 sm:grid-cols-3">{itemIds.map(id => {
      const item = wardrobe.find(piece => piece.id === id);
      return <div key={id} className="min-w-0 rounded-xl bg-white/80 p-2"><PiecePhoto key={item?.image_url || id} item={item} /><p className="mt-2 break-words text-xs leading-4 text-[#756e78]">{item?.name || "Piece no longer available"}</p></div>;
    })}</div>
    <div className="p-4">{ordinal && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#71638e]">Look {ordinal}</p>}<h3 className="serif text-2xl leading-tight">{name}</h3><p className="mt-2 text-sm leading-6 text-[#756e78]">{description}</p>{explanation && <p className="mt-2 text-sm leading-6 text-[#71638e]">{explanation}</p>}{footer && <div className="mt-4 border-t border-[#ebe7e7] pt-3">{footer}</div>}</div>
  </article>;
}

function PiecePhoto({ item }: { item:WardrobeItem | undefined }) {
  const [failed,setFailed] = useState(false);
  return <div className="flex aspect-square items-center justify-center rounded-lg bg-[#f9f7f4]">{item?.image_url && !failed ? <img src={item.image_url} alt={item.name} loading="lazy" className="h-full w-full object-contain" onError={() => setFailed(true)} /> : <Shirt aria-label={item ? "No photo available" : "Missing piece"} className="h-7 w-7 text-[#a69ac5]" />}</div>;
}
