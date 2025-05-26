"use client";

import * as React from "react";
import { Row } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { markAttendance } from "@/lib/apiUtils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { SessionData } from "./page";
import { extractLabSessionDateWithStartTime } from "@/lib/utils";

export interface StudentData {
    id: string;
    name: string;
    status: string;
    lab_SessionID: string;
    attendanceID: string;
}

interface MarkAttendanceButtonProps {
    row: Row<StudentData>;
    setCurrentLabSessions: React.Dispatch<React.SetStateAction<SessionData[]>>;
    updateCachedData: (updatedSession: SessionData) => void;
    addPendingAction: (action: any) => void;
    updatePendingActions: () => Promise<void>;
    setIsNetworkDown: (isDown: boolean) => void;
    currentLabSessions: SessionData[];
}

export default function MarkAttendanceButton({
    row,
    setCurrentLabSessions,
    updateCachedData,
    addPendingAction,
    updatePendingActions,
    setIsNetworkDown,
    currentLabSessions,
}: MarkAttendanceButtonProps) {
    const { data: session } = useSession();
    const [open, setOpen] = React.useState(false);
    const { toast } = useToast();

    const handleMarkAttendance = async () => {
        const studentId = row.original.id;
        const labSessionID = row.original.lab_SessionID;
        const jwtToken = session?.user?.backendJWT as string;

        const currentTime = new Date();
        const { date } = extractLabSessionDateWithStartTime(labSessionID);
        const sessionStartTime = new Date(date);

        const differenceInMinutes = (currentTime.getTime() - sessionStartTime.getTime()) / (1000 * 60);

        // Determine the attendance status based on time difference
        let attendanceStatus;
        if (differenceInMinutes > 60) {
            attendanceStatus = "Absent";
        } else if (differenceInMinutes > 30) {
            attendanceStatus = "Late";
        } else {
            attendanceStatus = "Present";
        }

        try {
            // setCurrentLabSessions((prevSessions) => {
            //     // Update the specific session where the lab_SessionID matches
            //     const updatedSessions = prevSessions.map((session) =>
            //         session.sessionDetails.lab_SessionID === labSessionID
            //             ? {
            //                   ...session,
            //                   students: session.students.map((student) =>
            //                       student.id === studentId ? { ...student, status: attendanceStatus } : student
            //                   ),
            //               }
            //             : session
            //     );

            //     // Find the updated session directly
            //     const updatedSession = updatedSessions.find(
            //         (session) => session.sessionDetails.lab_SessionID === labSessionID
            //     );

            //     // Ensure we have an updated session and call updateCachedData only with that session
            //     if (updatedSession) {
            //         updateCachedData({
            //             ...updatedSession,
            //         });
            //     }

            //     return updatedSessions;
            // });

            const updatedSession = currentLabSessions.find(
                (session) => session.sessionDetails.lab_SessionID === labSessionID
              );

            if (updatedSession) {
                const updatedStudents = updatedSession.students.map((student) =>
                    student.id === studentId ? { ...student, status: attendanceStatus } : student
                );
                const newSessionData = { ...updatedSession, students: updatedStudents };
                updateCachedData(newSessionData);
            }

            toast({
                title: "Attendance Marked as " + attendanceStatus,
                description: (() => {
                    switch (attendanceStatus) {
                        case "Present":
                            return "Attendance marked as Present successfully.";
                        case "Late":
                            return "You are more than 30 minutes late.";
                        case "Absent":
                            return "You have been marked as Absent. You are more than 60 minutes late.";
                        default:
                            return "Attendance status updated.";
                    }
                })(),
            });

            await markAttendance(row.original.attendanceID, attendanceStatus, jwtToken);

            setIsNetworkDown(false);
        } catch (error) {
            console.error("Error marking attendance:", error);

            addPendingAction({
                type: "markAttendance",
                data: { attendanceID: row.original.attendanceID, status: attendanceStatus },
            });

            await updatePendingActions();
            
            toast({
                title: "Offline Mode",
                description: "Attendance marked locally. It will be synced when online.",
            });
            setIsNetworkDown(true);
        }
    };

    return (
        row.original.status === "Pending" && (
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger asChild>
                    <Button size="sm">Mark Attendance</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Attendance</AlertDialogTitle>
                        <AlertDialogDescription>
                            Please ensure you are marking the attendance for the correct person.
                            <br />
                            <br />
                            <b>Name:</b> {row.original.name}
                            <br />
                            <b>Student ID:</b> {row.original.id}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex justify-end space-x-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMarkAttendance}>Confirm</AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        )
    );
}
