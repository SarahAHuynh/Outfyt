"use client";
/* eslint-disable @next/next/no-img-element -- Unsplash requires direct API-provided image hotlinks. */
import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { PhotoBatch } from "@/lib/stylist/photos";

export function ReferencePhotos({ batch }: { batch:PhotoBatch }) {
  if (!batch.photos.length) return null;
  return <section aria-label="Clothing reference photos" className="mt-4 rounded-2xl border border-[#ddd0eb] bg-[#faf7fd] p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-[#594273]">Style inspiration — not in your closet</p>
    <h3 className="serif mt-2 text-xl text-[#3e3548]">{batch.query}</h3>
    <p className="mt-1 text-xs leading-5 text-[#756e78]">Photo references may vary in color and style. These are not shopping listings.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">{batch.photos.map(photo => <article key={photo.id} className="overflow-hidden rounded-xl border border-[#e4dce9] bg-white">
      <ReferenceImage photo={photo} />
      <p className="p-3 text-xs leading-5 text-[#756e78]">Photo by <a href={photo.photographer_url} target="_blank" rel="noopener noreferrer" className="font-medium text-[#594273] underline">{photo.photographer}</a> on <a href="https://unsplash.com/?utm_source=outfyt&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="text-[#594273] underline">Unsplash</a></p>
    </article>)}</div>
  </section>;
}

function ReferenceImage({ photo }: { photo:PhotoBatch["photos"][number] }) {
  const [failed,setFailed] = useState(false);
  return <a href={photo.photo_url} target="_blank" rel="noopener noreferrer" aria-label={`View reference photo by ${photo.photographer} on Unsplash`} className="flex aspect-[3/4] items-center justify-center bg-[#f0ebf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#594273]">
    {failed ? <span className="flex flex-col items-center gap-2 px-3 text-center text-xs text-[#756e78]"><ImageOff className="h-6 w-6" />Photo unavailable. Open on Unsplash.</span> : <img src={photo.image_url} alt={photo.alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />}
  </a>;
}
