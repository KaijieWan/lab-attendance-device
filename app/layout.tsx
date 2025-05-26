import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import AuthProvider from "../lib/AuthProvider";
import { IsLoggedInCheckAndRedirect } from "@/lib/RoleChecker";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    manifest: "/manifest.json",
    title: "NTU Lab Attendance System",
    description: "Manage your lab attendance with ease.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <meta name='viewport' content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover'/>
                <meta name="ntu-lab" content="ntu-lab" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="ntu-lab" />
                <meta name="description" content="ntu-lab" />
                <meta name="format-detection" content="telephone=no" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="msapplication-TileColor" content="#2B5797" />
                <meta name="msapplication-tap-highlight" content="no" />
                <meta name="theme-color" content="#000000" />

                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="shortcut icon" href="/favicon.ico" />
            </head>
            <body className={inter.className}>
                <AuthProvider>
                    <IsLoggedInCheckAndRedirect>
                        <div className="flex">
                            <div className="flex-grow h-full">{children}</div>
                        </div>
                    </IsLoggedInCheckAndRedirect>
                </AuthProvider>
                <Toaster />
            </body>
        </html>
    );
}
