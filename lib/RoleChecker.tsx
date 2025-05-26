"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function isAdminAlerts(session: Session | null) {
    if (session == null) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unauthorised</AlertTitle>
                <AlertDescription>Please login and try again.</AlertDescription>
            </Alert>
        );
    } else if (session.user?.role === "Super Admin") {
        return <></>
    } else {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unauthorised</AlertTitle>
                <AlertDescription>Your role is not authorised to access this page.</AlertDescription>
            </Alert>
        );
    }
}

export function isAdminCheck(session: Session | null) {
    if (session == null) {
        return false;
    } else if (session.user?.role === "Super Admin") {
        return true;
    } else {
        return false;
    }
}

export function isLoggedInAlerts(session: Session | null) {
    if (session == null) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unauthorised</AlertTitle>
                <AlertDescription>Please login and try again.</AlertDescription>
            </Alert>
        );
    } 
    else {
        return <></>
    }
}

export function isLoggedInCheck(session: Session | null) {
    if (session == null) {
        return false;
    } else {
        return true;
    }
}

export function IsLoggedInCheckAndRedirect({ children }: { children: React.ReactNode }) {
    const { status, data: session } = useSession();
    const router = useRouter();
    const pathName = usePathname();
    const skipRedirect = pathName === "/login";

    useEffect(() => {
        if (status === "unauthenticated" && !skipRedirect) {
            router.push("/login");
        }
    }, [status, skipRedirect, router]);


    if (status === "authenticated" || skipRedirect) {
        
        return <div className="h-full">{children}</div>;
    }

    return null;
}
