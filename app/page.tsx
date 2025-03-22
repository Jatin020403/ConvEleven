import {ConvAI} from "@/components/ConvAI";

export default function Home() {
    return (
      <div className="grid grid-rows-[10px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 sm:p-4 font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-8 row-start-2 items-center">
          <ConvAI />
        </main>
      </div>
    );
}
