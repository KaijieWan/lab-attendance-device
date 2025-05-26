import React, { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { labToRooms, LabToRooms } from "@/lib/labToRooms";


export const checkPermission = (labName: string, labRoom: string, session: any | null) => {

    if (!session || !session.user) {
        // alert("You do not have permission to perform this action.");
        return false;
    }
    // Extract the labname and room from session.user
    // e.g. user.id = "swlab1rm1"
    console.log("Session user ID:", session?.user?.id);
    if(session.user.username){
        session.user.id = session.user.username;
    }
    
    const userIDLabName: string = session?.user?.id?.split("rm")[0] || "";
    const userIDLabRoom: string = session?.user?.id?.split("rm")[1] || "";

    const sameLabAndRoom = userIDLabName.toUpperCase() == labName.toUpperCase() && userIDLabRoom == labRoom;
    // console.log("curr lab: ", labName.toUpperCase(), "curr room: ", labRoom);
    // console.log("user lab: ", userIDLabName, "user room: ", userIDLabRoom);

    if (userIDLabName && userIDLabRoom && labToRooms[userIDLabName.toUpperCase() as keyof LabToRooms].includes(parseInt(userIDLabRoom)) && sameLabAndRoom) {
        // console.log("valid");
        return true;
    }

    // alert("Unauthorised. You do not have permission to perform this action.");
    return false;
};

interface PermissionCheckerProps {
    labName: string;
    labRoom: string;
    children: ReactNode;
}

const LabChecker: React.FC<PermissionCheckerProps> = ({ labName, labRoom, children }) => {
    console.log("LabChecker component mounted");
    const { data: session, status } = useSession();
    console.log("Session status:", status); // Check if the session is loading or available

    if (status === "loading") {
        return <div>Loading...</div>;
    }

    if (!session || !session.user) {
        return (
            <div>
                <p>No session available. Please log in first.</p>
            </div>
        );
    }

    console.log("Session user ID:", session?.user?.id);

    if (!session || !session.user) {
        return <div />;
    }

    // Extract the labname and room from session.user
    // e.g. user.id = "swlab1rm1"
    console.log("Session user ID:", session?.user?.id);
    if(session.user.username){
        session.user.id = session.user.username;
    }    
    const userIDLabName: string = session?.user?.id?.split("rm")[0] || "";
    const userIDLabRoom: string = session?.user?.id?.split("rm")[1] || "";
    
    const sameLabAndRoom = userIDLabName.toUpperCase() == labName.toUpperCase() && userIDLabRoom == labRoom;

    const hasPermission = userIDLabName && userIDLabRoom && labToRooms[userIDLabName.toUpperCase() as keyof LabToRooms].includes(parseInt(userIDLabRoom)) && sameLabAndRoom;

    return hasPermission ? (
        <>{children}</>
    ) : (
        <div className="px-10 mt-4">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unauthorised</AlertTitle>
                <AlertDescription>
                    You do not have permissions to view this page. Please try logging in again.
                </AlertDescription>
            </Alert>
        </div>
    );
};

export default LabChecker;
