"use client";
import { Button } from "@/components/ui/button";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { labToRooms, LabToRooms } from "@/lib/labToRooms";
// Rooms each lab have


export default function Home() {
    const { data: session } = useSession();
    const router = useRouter();
    console.log(session);

    const handleLogout = () => {
        signOut();
    };
    // Extract the labname and room from session.user
    // e.g. user.id = "swlab1rm1"
    const labName: string = session?.user?.id?.split("rm")[0] || "";
    const room: string = session?.user?.id?.split("rm")[1] || "";

    // Check whether labName and room are valid
    // If valid, direct to the lab page
    if (labName && room && labToRooms[labName.toUpperCase() as keyof LabToRooms].includes(parseInt(room))) {
        router.push(`/labs/${labName}/${room}`);
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
            <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
                Home Page
                {session && <Button onClick={handleLogout} className="ml-auto">Logout</Button>}
            </div>
            {/* Show logged in user details */}
            <div className="flex flex-col items-center justify-center">
                {session ? (
                    <div className="flex flex-col items-center justify-center">
                        <h1 className="text-3xl font-semibold">Welcome, {session?.user?.name}</h1>
                        <p className="text-lg font-medium">You are logged in as {session?.user?.id}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center">
                        <h1 className="text-3xl font-semibold">Welcome</h1>
                        <p className="text-lg font-medium">You are not logged in</p>
                    </div>
                )}
            </div>
        </main>
    );
}