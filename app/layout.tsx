import type {Metadata} from "next";
import "./globals.css";
import {BackgroundWave} from "@/components/background-wave";

export const metadata: Metadata = {
    title: "ConvAI",
};

export default function RootLayout({children}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={"h-full w-full"}>
        <body className={`antialiased w-full h-full lex flex-col`}>
        <div className="flex flex-col flex-grow w-full items-center justify-center sm:px-4">
            <nav
                className={
                    "sm:fixed w-full top-0 left-0 grid grid-cols-2 py-4 px-8"
                }
            >
            </nav>
            {children}
            <BackgroundWave/>
        </div>
        </body>
        </html>
    );
}
