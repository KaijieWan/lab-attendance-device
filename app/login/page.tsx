"use client";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { clearLabSessions, clearMarkedStudents, initDB } from "@/lib/indexedDB";

export default function LoginPage() {
    const [labId, setLabId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (event: any) => {
        event.preventDefault();
        const result = await signIn("credentials", {
            redirect: false,
            username: labId,
            password,
            callbackUrl: `/labs/${labId}`
        });
        
        if (result && result.error) {
            switch (result.error) {
                case "CredentialsSignin":
                    setError("Invalid Lab ID or Password");
                    break;
                default:
                    setError("An unexpected error occurred. Please try again.");
            }
        } else {                
            const session = await getSession();
            if (session && session.user && session.user.name) {
                
                await initDB();
                await clearLabSessions();
                await clearMarkedStudents();
                
                const name  = session.user.name;
                const [labName, roomNumber] = name.split(" Room ");
                router.push(`/labs/${labName}/${roomNumber}`);
            } else {
                setError("Failed to retrieve session. Please try again.");
            }
        }
    };

    return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-background">
            <div className="mx-auto w-full max-w-md space-y-6 px-4 py-12 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Lab Device Login</h1>
                    <p className="mt-2 text-muted-foreground">Enter your corresponding Lab ID and Password</p>
                </div>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <Label htmlFor="lab-id">Lab ID</Label>
                        <Input
                            id="lab-id"
                            type="text"
                            placeholder="Enter your Lab ID"
                            value={labId}
                            onChange={(e) => setLabId(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <p className="text-red-500">{error}</p>}
                    <Button type="submit" className="w-full">
                        Sign In
                    </Button>
                </form>
            </div>
        </div>
    );
}
