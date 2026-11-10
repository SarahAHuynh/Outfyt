import Image from "next/image";
import Link from "next/link";
import { ArrowRight,Heart,Shirt,Sparkles } from "lucide-react";

// Fixed API-provided hotlinks retain Unsplash's ixid; no search/key is needed at render time.
const photos={
  outfit:{
    src:"https://images.unsplash.com/photo-1614676471928-2ed0ad1061a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMTI1NTk3fDB8MXxzZWFyY2h8MXx8Y2xvdGhpbmclMjBmbGF0JTIwbGF5fGVufDF8fHx8MTc5NDM1MTQwOXww&ixlib=rb-4.1.0&q=80&w=1080",
    alt:"Warm brown knitwear, ankle boots and checked trousers arranged as an outfit",
  },
  wardrobe:{
    src:"https://images.unsplash.com/photo-1558769132-cb1aea458c5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMTI1NTk3fDB8MXxzZWFyY2h8MXx8Y2xvdGhpbmclMjB3YXJkcm9iZXxlbnwxfHx8fDE3OTQzNTEzOTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt:"Cream, beige and rust-colored clothing hanging on a wooden clothes rail",
  },
  knitwear:{
    src:"https://images.unsplash.com/photo-1621198059871-0d5f9b449233?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMTI1NTk3fDB8MXxzZWFyY2h8Mnx8Y2xvdGhpbmclMjBmbGF0JTIwbGF5fGVufDF8fHx8MTc5NDM1MTQwOXww&ixlib=rb-4.1.0&q=80&w=1080",
    alt:"A folded white knitted sweater and a leafy branch on pale wooden boards",
  },
};
const credits=[
  { name:"Zoe",href:"https://unsplash.com/@_imd?utm_source=outfyt&utm_medium=referral" },
  { name:"Alyssa Strohmann",href:"https://unsplash.com/@anotherlovely?utm_source=outfyt&utm_medium=referral" },
  { name:"Shelter",href:"https://unsplash.com/@shelter?utm_source=outfyt&utm_medium=referral" },
];

export default function Home() {
  return <main className="grain min-h-screen overflow-hidden bg-[#f9f7f4]">
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-7 sm:px-8 lg:px-12">
      <Link href="/" aria-label="Outfyt home" className="serif text-3xl tracking-tight text-[#3e3548]">outfyt<span className="text-[#a69ac5]">.</span></Link>
      <p className="hidden text-xs tracking-wide text-[#756e78] sm:block">your everyday, reimagined.</p>
    </header>

    <section aria-labelledby="home-title" className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-14 pt-9 sm:px-8 sm:pt-12 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:px-12 lg:pb-20 lg:pt-14">
      <div className="relative z-10 max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[.19em] text-[#71638e] sm:text-xs">your closet. your aesthetic. your way.</p>
        <h1 id="home-title" className="serif mt-6 text-[3.35rem] leading-[1.02] tracking-[-.045em] text-[#3e3548] sm:text-7xl lg:text-[5.25rem]">Get dressed<br /><em className="text-[#594273]">like you mean it.</em></h1>
        <p className="mt-7 max-w-sm text-base leading-8 text-[#756e78] sm:text-lg">Your favorite pieces. A fresh point of view. Turn the clothes you already own into outfits that feel unmistakably you.</p>
        <Link href="/dashboard" className="mt-8 inline-flex items-center gap-4 rounded-full bg-[#594273] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#594273]/15 transition hover:bg-[#47345d]">Start styling<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        <p className="mt-4 text-xs text-[#756e78]">A little inspiration for your everyday.</p>
      </div>

      <figure aria-label="Clothing inspiration collage" className="mx-auto w-full max-w-[560px]">
        <div className="relative isolate aspect-[1.04/1] w-full">
          <div aria-hidden="true" className="absolute inset-x-[8%] inset-y-[7%] -rotate-6 rounded-[45%_45%_35%_35%] bg-[#e8dfed]/80" />
          <div className="absolute left-[2%] top-[5%] h-[88%] w-[59%] -rotate-[5deg] overflow-hidden rounded-t-[45%] rounded-b-3xl border-[6px] border-white bg-[#ded3ca] shadow-xl shadow-[#5b4057]/15">
            <Image src={photos.outfit.src} alt={photos.outfit.alt} fill unoptimized preload sizes="(max-width: 640px) 58vw, (max-width: 1024px) 330px, 320px" className="object-cover" />
          </div>
          <div className="absolute right-0 top-[3%] h-[43%] w-[43%] rotate-[7deg] overflow-hidden rounded-2xl border-[5px] border-white bg-[#e6ded4] shadow-lg shadow-[#5b4057]/10 sm:rounded-3xl">
            <Image src={photos.wardrobe.src} alt={photos.wardrobe.alt} fill unoptimized sizes="(max-width: 640px) 42vw, 240px" className="object-cover object-[65%_center]" />
          </div>
          <div className="absolute bottom-[8%] right-[1%] h-[43%] w-[46%] rotate-[4deg] overflow-hidden rounded-2xl border-[5px] border-white bg-[#eeeae2] shadow-xl shadow-[#5b4057]/10 sm:rounded-3xl">
            <Image src={photos.knitwear.src} alt={photos.knitwear.alt} fill unoptimized sizes="(max-width: 640px) 44vw, 260px" className="object-cover object-[35%_center]" />
          </div>
          <div className="absolute bottom-[1%] left-[15%] z-10 flex items-center gap-3 rounded-2xl border border-white bg-[#fffdfa]/95 px-4 py-3 shadow-lg shadow-[#5b4057]/10 sm:px-5 sm:py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eee9f4] text-[#594273]"><Sparkles aria-hidden="true" className="h-4 w-4" /></span>
            <div><p className="text-[10px] uppercase tracking-[.13em] text-[#756e78]">the everyday edit</p><p className="serif mt-0.5 text-lg text-[#594273] sm:text-xl">A little more you.</p></div>
          </div>
        </div>
        <figcaption className="mx-auto mt-6 max-w-sm text-center text-[11px] leading-5 text-[#756e78]">Photos by {credits.map((credit,index)=><span key={credit.name}>{index>0 ? ", " : ""}<a href={credit.href} target="_blank" rel="noopener noreferrer" className="underline decoration-[#b6a7c2] underline-offset-2">{credit.name}</a></span>)} on <a href="https://unsplash.com/?utm_source=outfyt&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline decoration-[#b6a7c2] underline-offset-2">Unsplash</a>.</figcaption>
      </figure>
    </section>

    <section aria-labelledby="features-title" className="border-t border-[#e7dfe9] bg-white/45 px-6 py-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl"><p className="text-center text-[11px] font-semibold uppercase tracking-[.2em] text-[#8a759d]">familiar pieces, new possibilities</p><h2 id="features-title" className="serif mt-3 text-center text-3xl text-[#3e3548] sm:text-4xl">Your wardrobe, with a point of view.</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">{[
          { icon:Shirt,title:"Know your closet",text:"Bring your everyday pieces together in one beautiful, organized space." },
          { icon:Sparkles,title:"Find your formula",text:"Tell your stylist the mood and the moment. Discover combinations from your own clothes." },
          { icon:Heart,title:"Make it yours",text:"Shape your Style DNA and keep the looks you love coming back to." },
        ].map(({ icon:Icon,title,text })=><div key={title} className="flex items-start gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eee9f4] text-[#71638e]"><Icon aria-hidden="true" className="h-[18px] w-[18px]" /></div><div><h3 className="serif text-xl text-[#3e3548]">{title}</h3><p className="mt-2 text-sm leading-7 text-[#756e78]">{text}</p></div></div>)}</div>
      </div>
    </section>
  </main>;
}
