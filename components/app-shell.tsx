import { Sidebar } from "./sidebar";

type AppShellProps = {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  contentClassName?: string;
};

export function AppShell({ children, title, eyebrow, contentClassName }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f9f7f4] md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 px-5 pb-12 pt-20 md:px-10 md:pt-10 lg:px-14">
        <div className={contentClassName}>
          <header className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#a69ac5]">{eyebrow ?? "outfyt studio"}</p>
            <h1 className="serif mt-2 text-4xl tracking-[-.03em] md:text-5xl">{title}</h1>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
