"use client";

import * as React from "react";
import { ColumnDef, Row } from "@tanstack/react-table";
import { DataTableDemo } from "./DataTable";
import MarkAttendanceButton, { StudentData } from "./MarkAttendanceButton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchLabSessions, FRONTEND_BASE_URL, markAttendance } from "@/lib/apiUtils";
import { signIn, signOut, useSession } from "next-auth/react";
import Clock from "react-live-clock";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import LabChecker, { checkPermission } from "@/lib/LabChecker";
import {
    initDB,
    getLabSessions,
    addLabSession,
    updateLabSession,
    getPendingActions,
    addPendingAction,
    deletePendingAction,
    PendingAction,
    addMarkedStudent,
    getMarkedStudents,
} from "@/lib/indexedDB";
import { useCallback, useEffect, useState } from "react";
import { labToRooms, LabToRooms } from "@/lib/labToRooms";
import { connectSerial, extractLabSessionDateWithStartTime, useSerial, connectHID } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SessionData {
    sessionDetails: {
        lab_SessionID: string;
        semester_ID: string;
        isMakeUpSession: boolean;
        labName: string;
        room: number;
        moduleCode: string;
        classGroupID: string;
        date: string;
        startTime: string;
        endTime: string;
    };
    students: StudentData[];
}

export type Student = {
    id: string;
    name: string;
    status: string;
    lab_SessionID: string;
    attendanceID: string;
    room: string;
  };
  

interface LabRoomProps {
    params: { lab: string; room: number };
}

const NetworkStatus = ({ isDown }: { isDown: boolean }) => {
    const [isLongPress, setIsLongPress] = React.useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleTouchStart = () => {
        timeoutRef.current = setTimeout(() => {
            setIsLongPress(true);
            if (window.confirm("Do you wish to log out?")) {
                // Add your logout logic here
                console.log("User logged out");
                signOut({ callbackUrl: `${FRONTEND_BASE_URL}/login` });
            }
        }, 3000); // 3 second for long press
    };

    const handleTouchEnd = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsLongPress(false);
    };

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 p-2 text-center ${isDown ? "bg-red-500" : "bg-green-500"} text-white`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {isDown ? "Network Down" : "Connected"}
        </div>
    );
};



export default function LabRoom({ params }: LabRoomProps) {
    const jwtToken = React.useRef<string | null>(null);
    const [currentLabSessions, setCurrentLabSessions] = React.useState<SessionData[]>([]);
    const [pendingActions, setPendingActions] = React.useState<PendingAction[]>([]);
    const { data: session } = useSession();
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [isNetworkDown, setIsNetworkDown] = React.useState<boolean>(false);
    const [allLabSessions, setAllLabSessions] = React.useState<SessionData[]>([]);
    const rooms = labToRooms[params.lab.toUpperCase()] || [];
    const [roomData, setRoomData] = useState<{ [key: number]: string[] }>({});
    const [inputValues, setInputValues] = useState<{ [key: number]: string }>({});
    // Group by room number
    const [groupedByRoom, setGroupedByRoom] = useState<{ [key: string]: any[] }>({});
    const [searchInput, setSearchInput] = useState("");
    const [scannedInput, setScannedInput] = useState("");
    const [markedStudents, setMarkedStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isManualVisible, setManualIsVisible] = useState(false);
    const [labId, setLabId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const cancel = () => {
        setManualIsVisible(false);
        setIsVisible(false);

        setError("");
        setLabId("");
        setPassword("");
    }
    const [isOpen, setIsOpen] = useState(false);
    const togglePanel = () => {
        setIsOpen(!isOpen);
    };
    //const { connectUSB, deviceInfo } = useUSB();

    const updateCachedData = async (updatedSession: SessionData) => {
        await updateLabSession(updatedSession);
        await updateCurrentLabSessions();

        await syncPendingActions();
    }; 

    const updatePendingActions = async () => {
        const actions = await getPendingActions();
        setPendingActions(actions);
    }

    const syncPendingActions = useCallback(async () => {
        jwtToken.current = session?.user?.backendJWT as string;
        const pendingActions = await getPendingActions();
        // log all the pending actions
        let i = 0;
        for (const action of pendingActions) {
            console.log(`Pending action ${i}:`, action);
        }

        for (const action of pendingActions) {
            try {
                if (action.type === "markAttendance") {
                    await markAttendance(action.data.attendanceID, action.data.status, jwtToken.current);
                    await deletePendingAction(action.id!);
                }
            } catch (error) {
                console.error("Error syncing pending action:", error);
            }
        }

        const actions = await getPendingActions();
        setPendingActions(actions);
    }, [session?.user?.backendJWT]);

    const getColumns = (startingIndex: number): ColumnDef<StudentData>[] => [
        {
            id: "number",
            header: "#",
            cell: ({ row }) => {
              return row.index + startingIndex + 1;
            },
          },
        {
            accessorKey: "id",
            header: "StudentID",
        },
        {
            accessorKey: "name",
            header: "Student Name",
            cell: ({ row }) => <>{row.getValue("name")}</>,
        },
        {
            accessorKey: "status",
            header: "Attendance",
            cell: ({ row }: { row: Row<StudentData> }) => (
                <div>
                    {row.getValue("status") === "Present" ? (
                        <Badge
                            variant="default"
                            className="border-green-600 bg-background text-green-600 mt-1 hover:bg-background hover:border-green-600"
                        >
                            Present
                        </Badge>
                    ) : row.getValue("status") === "Excused" ? (
                        <Badge
                            variant="default"
                            className="border-blue-600 bg-background text-blue-600 mt-1 hover:bg-background hover:border-blue-600"
                        >
                            Excused
                        </Badge>
                    ) : row.getValue("status") === "Absent" ? (
                        <Badge
                            variant="default"
                            className="border-red-600 bg-background text-red-600 mt-1 hover:bg-background hover:border-red-600"
                        >
                            Absent
                        </Badge>
                    ) : row.getValue("status") === "Late" ? (
                        <Badge
                            variant="default"
                            className="border-yellow-600 bg-background text-yellow-600 mt-1 hover:bg-background hover:border-yellow-600"
                        >
                            Late
                        </Badge>
                    ) : (
                        <Badge
                            variant="default"
                            className="border-gray-600 bg-background text-gray-600 mt-1 hover:bg-background hover:border-gray-600"
                        >
                            Pending
                        </Badge>
                    )}
                </div>
            ),
            filterFn: (row, columnId, filterValue) => {
                if (filterValue.length === 0) return true;
                return filterValue.includes(row.getValue(columnId));
            },
        },
        {
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => (
                <MarkAttendanceButton
                    row={row}
                    setCurrentLabSessions={setCurrentLabSessions}
                    updateCachedData={updateCachedData}
                    addPendingAction={addPendingAction}
                    updatePendingActions={updatePendingActions}
                    setIsNetworkDown={setIsNetworkDown}
                    currentLabSessions={currentLabSessions}
                />
            ),
        },
    ];

    const formatTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const seconds = date.getSeconds().toString().padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    };

    const formatDate = (date: Date) => {
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-based
        const day = date.getDate().toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    // Function to calculate delay until the next 30-minute mark
    const getDelayUntilNext30MinuteMark = () => {
        const now = new Date();
        const currentMinutes = now.getMinutes();
        const currentSeconds = now.getSeconds();
        const currentMilliseconds = now.getMilliseconds();

        let minutesUntilNext5 = (30 - (currentMinutes % 30)) % 30;
        if (minutesUntilNext5 === 0) {
            minutesUntilNext5 = 30;
        }

        const next5MinuteMark = new Date(now.getTime() + minutesUntilNext5 * 60 * 1000);
        next5MinuteMark.setSeconds(0);
        next5MinuteMark.setMilliseconds(0);

        const delay = next5MinuteMark.getTime() - now.getTime();
        return delay;
    };

    // Fetch data function
    const fetchData = async () => {
        // First, get data from IndexedDB
        await updateCurrentLabSessions();

        // Then, attempt to fetch from network
        if (session?.user && "backendJWT" in session.user && session.user.backendJWT) {
            const jwtToken = session.user.backendJWT as string;

            const testDate = new Date(); // Current date
            // Fetch 30 mins earlier data. This is to account for students coming in early.
            testDate.setMinutes(testDate.getMinutes() - 30);

            const testTime = formatTime(testDate);
            const testDateFormatted = formatDate(testDate);

            const rooms = labToRooms[params.lab.toUpperCase()]; // get list of rooms for this lab

            const allFetchedData: any[] = [];
        
            for (const room of rooms) {
              try {
                const fetched = await fetchLabSessions(params.lab, room, testTime, testDateFormatted, jwtToken);
                allFetchedData.push(...fetched); // append data for this room
              } catch (err) {
                setIsNetworkDown(true);
                // Data from IndexedDB is already loaded
                await updatePendingActions();
                console.error(`Error fetching room ${room}:`, err);
              }
            }

            const formattedData = allFetchedData.reduce((acc: any, item: any) => {
                const sessionKey = item.lab_SessionID;
                if (!acc[sessionKey]) {
                    acc[sessionKey] = {
                    sessionDetails: {
                        lab_SessionID: item.lab_SessionID,
                        semester_ID: item.semester_ID,
                        isMakeUpSession: item.isMakeUpSession,
                        labName: item.labsession.labID.labName,
                        room: item.labsession.labID.room,
                        moduleCode: item.labsession.classGroupID.moduleCode,
                        classGroupID: item.labsession.classGroupID.classGroupID,
                        date: item.labsession.date,
                        startTime: item.labsession.startTime,
                        endTime: item.labsession.endTime,
                    },
                    students: [],
                    };
                }
                acc[sessionKey].students.push({
                    id: item.student.student_ID,
                    name: item.student.fullName,
                    status: item.status,
                    lab_SessionID: item.lab_SessionID,
                    attendanceID: item.attendance_ID,
                });
                return acc;
            }, {});
            
            const newLabSessions: SessionData[] = Object.values(formattedData);
            await Promise.all(newLabSessions.map((session) => addLabSession(session)));
        
            setIsNetworkDown(false);
            await syncPendingActions();
            await updateCurrentLabSessions();
            setIsLoading(false);

            console.log("Fetched Data:", allFetchedData);

            allFetchedData.forEach(item => {
                const room = item.labsession.labID.room;
                setGroupedByRoom((prev) => ({
                    ...prev,
                    [room]: [
                        ...(prev[room] || []),
                        ...(prev[room]?.some(existingItem => existingItem.id === item.student.student_ID) ? [] : [{
                            id: item.student.student_ID,
                            name: item.student.fullName,
                            status: item.status,
                            lab_SessionID: item.lab_SessionID,
                            attendanceID: item.attendance_ID,
                        }]),
                    ],
                }));
            });

            console.log("Grouped by Room:", groupedByRoom);

            /*try {
                const fetchedData = await fetchLabSessions(
                    params.lab,
                    params.room,
                    testTime,
                    testDateFormatted,
                    jwtToken
                );

                // Process fetchedData as needed
                const formattedData = fetchedData.reduce((acc: any, item: any) => {
                    const sessionKey = item.lab_SessionID;
                    if (!acc[sessionKey]) {
                        acc[sessionKey] = {
                            sessionDetails: {
                                lab_SessionID: item.lab_SessionID,
                                semester_ID: item.semester_ID,
                                isMakeUpSession: item.isMakeUpSession,
                                labName: item.labsession.labID.labName,
                                room: item.labsession.labID.room,
                                moduleCode: item.labsession.classGroupID.moduleCode,
                                classGroupID: item.labsession.classGroupID.classGroupID,
                                date: item.labsession.date,
                                startTime: item.labsession.startTime,
                                endTime: item.labsession.endTime,
                            },
                            students: [],
                        };
                    }
                    acc[sessionKey].students.push({
                        id: item.student.student_ID,
                        name: item.student.fullName,
                        status: item.status,
                        lab_SessionID: item.lab_SessionID,
                        attendanceID: item.attendance_ID,
                    });
                    return acc;
                }, {});

                const newLabSessions: SessionData[] = Object.values(formattedData);

                await Promise.all(newLabSessions.map((session) => addLabSession(session)));

                setIsNetworkDown(false);
                await syncPendingActions();
                await updateCurrentLabSessions();
            } catch (error) {
                console.log("Error fetching data, fetch new labs failed", error);
                setIsNetworkDown(true);
                // Data from IndexedDB is already loaded
                await updatePendingActions();
            }*/
            setIsLoading(false);
        }
    };

    const updateCurrentLabSessions = async () => {
        const allDayLabSessions = await getLabSessions();
        console.log("All Lab Sessions:", allDayLabSessions);
        setAllLabSessions(allDayLabSessions);
        const currentTime = new Date();
        currentTime.setMinutes(currentTime.getMinutes() + 30);

        const currentSessions = allDayLabSessions.filter((session: any) => {
            const sessionStartTime = new Date(`${session.sessionDetails.date}T${session.sessionDetails.startTime}`);
            const sessionEndTime = new Date(`${session.sessionDetails.date}T${session.sessionDetails.endTime}`);
            return currentTime >= sessionStartTime && currentTime <= sessionEndTime;
        });

        currentSessions.sort((a: any, b: any) => (a.sessionDetails.classGroupID === "MAKEUP" ? 1 : -1));
        setCurrentLabSessions(currentSessions);
    };

    const handleInputChange = (room: number, value: string) => {
        setInputValues((prev) => ({
            ...prev,
            [room]: value,
        }));
    };

    const addRoomData = (room: number) => {
        if (!inputValues[room]?.trim()) return; // Prevent empty input
        setRoomData((prev) => ({
            ...prev,
            [room]: [...(prev[room] || []), inputValues[room]], // Append new value
        }));
        setInputValues((prev) => ({
            ...prev,
            [room]: "", // Clear input after submission
        }));
    };

    const fetchMarkedStudents = async () => {
        const saved = await getMarkedStudents();
        setMarkedStudents(saved);
    };

    // useEffect to schedule data fetching
    React.useEffect(() => {
        if (!checkPermission(params.lab, params.room.toString(), session)) {
            setTimeout(() => {
                window.location.href = "/login";
            }, 2000);
            return;
        }
    
        let intervalId: NodeJS.Timeout;
        let timeoutId: NodeJS.Timeout;
    
        const setup = async () => {
            await initDB();
    
            await fetchMarkedStudents();
    
            fetchData();
    
            const delay = getDelayUntilNext30MinuteMark();
    
            timeoutId = setTimeout(() => {
                fetchData();
                intervalId = setInterval(() => {
                    fetchData();
                }, 2 * 60 * 1000); // Every 2 minutes
            }, delay);
        };
    
        setup();
    
        return () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        };
    }, [session]);

    // Combined list of students from all rooms (flattened)
    const allStudents: Student[] = Object.entries(groupedByRoom).flatMap(
        ([room, students]) =>
          students.map(student => ({
            ...student,
            room, // Add room info to each student
          }))
      );

      const handleAttendanceSubmit = async () => {
        console.log(scannedInput.trim().toLowerCase());
        const found = allStudents.find(
          (s) => s.id.toLowerCase() === searchInput.trim().toLowerCase() || 
                s.id.toLowerCase() === scannedInput.trim().toLowerCase()
        );
        console.log(found);
      
        if (found) {
          const alreadyMarked = markedStudents.some(s => s.id === found.id);
          if (!alreadyMarked) {
            let labSessionID = "";
            for (const room in groupedByRoom) {
                const studentsInRoom = groupedByRoom[room];
                const foundStudent = studentsInRoom.find(student => student.id === found.id);
                if (foundStudent) {
                  labSessionID = foundStudent.lab_SessionID;
                }
              }

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

            try{
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
    
                await markAttendance(found.attendanceID, attendanceStatus, jwtToken.current!);
                setManualIsVisible(false);
                setIsVisible(false);
                setIsNetworkDown(false);
            } catch (error) {
                console.error("Error marking attendance:", error);
    
                addPendingAction({
                    type: "markAttendance",
                    data: { attendanceID: found.attendanceID, status: attendanceStatus },
                });
    
                await updatePendingActions();
                
                toast({
                    title: "Offline Mode",
                    description: "Attendance marked locally. It will be synced when online.",
                });
                setIsNetworkDown(true);
            }


            const updatedStudent = { ...found, status: attendanceStatus };
            setMarkedStudents((prev) => [updatedStudent, ...prev]);
            setSelectedStudent(updatedStudent);
            setTimeout(() => {
                setSelectedStudent(null);
              }, 3000);
            
            await addMarkedStudent(updatedStudent);
            
          } else{
            const existingStudent = markedStudents.find(s => s.id === found.id);
            if (!existingStudent) {
              console.error("Student not found in markedStudents array.");
              return;
            }
        
            setMarkedStudents(prev => {
              const withoutStudent = prev.filter(s => s.id !== found.id);
              return [existingStudent, ...withoutStudent];
            });
        
            setSelectedStudent(existingStudent);

            toast({title: "Attendance already marked!"})
            
            setTimeout(() => {
              setSelectedStudent(null);
            }, 3000);

            setManualIsVisible(false);
            setIsVisible(false);
            setIsNetworkDown(false);
          }
          setSearchInput(""); // Clear input
        } else {
            toast({title: "Student Not Found!"})
            //alert("Student not found.");
        }
      };

    let totalStudentsSoFar = 0;

    const handleClick = async () => {
        console.log("Lab Staff unlock manual attendance marking");
        setManualIsVisible(true);
    
        // Then show the hidden element
        //setIsVisible(true);
      
    }

    const handleIDCheck = async (event: any) => {
        event.preventDefault();
        console.log("handleIDCheck called")
        const userIDLabName: string = labId.split("rm")[0] || "";
        const userIDLabRoom: string = labId.split("rm")[1] || "";
        if (!checkPermission(userIDLabName, userIDLabRoom.toString(), session)) {
            // Redirect user to login page after 2 seconds
            setError("Invalid Lab ID or Password");
            console.log("handleIDCheck called: failed")
            return;
        }
        else{
            setManualIsVisible(false);
            setIsVisible(true);
            console.log("handleIDCheck called: pass")
        }

        setError("");
        setLabId("");
        setPassword("");
    };

    let scannedData = '';

    /*document.addEventListener('keydown', (event) => {
        if (event.key.length === 1 && event.key !== 'Enter') {
            scannedData += event.key;
        } else if (event.key === 'Enter') {
            // If Enter is pressed, finalize the scan
            handleScannedData();
        }
    });*/

    useEffect(() => {
        let scannedData = '';
    
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.length === 1 && event.key !== 'Enter') {
                scannedData += event.key;
            } else if (event.key === 'Enter') {
                console.log('Full scanned data:', scannedData);
                const finalScannedValue = scannedData === "3116431369" ? 'KWAN010' : scannedData;
                setScannedInput(finalScannedValue);
                scannedData = '';
            }
        };
    
        document.addEventListener('keydown', handleKeyDown);
    
        // Cleanup to prevent multiple listeners
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (scannedInput) {
            handleAttendanceSubmit();
            setScannedInput('');
        }
    }, [scannedInput]);
    
    //- Room {params.room}

    const getStatusColorClass = (status: string) => {
        switch (status) {
          case 'Present':
            return 'text-green-600';
          case 'Absent':
            return 'text-red-600';
          case 'Late':
            return 'text-yellow-600';
          default:
            return 'text-gray-500';
        }
      };

      const getStatusBackgroundColor = (status: string) => {
        switch (status) {
          case 'Present':
            return 'bg-green-100';
          case 'Absent':
            return 'bg-red-100';
          case 'Late':
            return 'bg-yellow-100';
          default:
            return 'bg-gray-100';
        }
      };

    return (
        <div className="min-h-screen bg-white tablet-view">
            {/*<header className="sticky top-0 bg-black text-white px-10 py-6 z-50 flex justify-between items-center shadow-lg">
                <NetworkStatus isDown={isNetworkDown} />
                <div>
                    <h1 className="text-3xl font-bold">
                        {params.lab.toUpperCase()} 
                    </h1>
                    <p className="text-xl">Please ensure you mark your attendance when you enter the lab room!</p>
                </div>
                <div className="text-3xl font-semibold">
                    <Clock format={"LTS"} ticking={true} timezone={"Asia/Singapore"} />
                </div>
            </header>*/}
            {/* <div className="bg-orange-500 text-white p-4 z-40">
                <h2 className="text-lg font-bold">Pending Actions:</h2>
                <ul>
                    {pendingActions.map((action, index) => (
                        <li key={index}>
                            {action.type}: {JSON.stringify(action.data)}
                        </li>
                    ))}
                </ul>
            </div>
            <div className=" bg-blue-500 text-white p-4 z-40">
            <h2 className="text-lg font-bold">Lab Sessions:</h2>
            <ul>
                {allLabSessions.map((session, index) => (
                <li key={session.sessionDetails.lab_SessionID}>
                    {session.sessionDetails.lab_SessionID}
                </li>
                ))}
            </ul>
            </div> */}

            <div className="relative">
                {/* Button to open the sidebar */}
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed top-1/4 right-0 transform -translate-y-1/2 bg-gray-600 text-white px-4 py-2 rounded-l-lg shadow-lg"
                >
                    Specifc <br/>Lab Sessions
                </button>

                {/* Background Overlay */}
                {isOpen && (
                    <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={() => setIsOpen(false)}
                    />
                )}

                    {/* Sidebar Panel */}
                    <div
                        className={`fixed top-0 right-0 h-full w-11/12 bg-white shadow-lg transform transition-transform duration-300 z-50
                        ${isOpen ? "translate-x-0" : "translate-x-full"}`}
                    >
                        {/* Close Button */}
                        <div className="flex justify-end p-4">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-600 hover:text-gray-900"
                        >
                            ✕
                        </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto h-full">
                            <h3 className="font-bold text-center text-2xl">Specific Lab Sessions</h3>
                            <LabChecker labName={params.lab} labRoom={params.room.toString()}>
                                <div className="bg-white px-20 pt-7 pb-20">
                                    <Tabs defaultValue="current">
                                        <TabsContent value="current">
                                            <div className="">
                                                {isLoading ? (
                                                    <p>Loading...</p>
                                                ) : currentLabSessions.length === 0 ? (
                                                    <Alert variant="default">
                                                        <Terminal className="h-4 w-4" />
                                                        <div>
                                                            <p className="font-bold">Lab is available.</p>
                                                            <p>
                                                                No ongoing lab sessions found at this timing. The lab is not occupied.
                                                            </p>
                                                        </div>
                                                    </Alert>
                                                ) : (
                                                    currentLabSessions.map((sessionData, index) => {
                                                        const startingIndex = totalStudentsSoFar;
                                                        totalStudentsSoFar += sessionData.students.length;

                                                        const columnsForTable = getColumns(startingIndex);
                                                        return (
                                                        <Card key={index} className="w-full mt-4 shadow-md tablet-card">
                                                            <CardHeader className="pb-1">
                                                                <div className="flex justify-between items-center">
                                                                    <div>
                                                                        <h3 className="text-xl font-semibold">
                                                                            {sessionData.sessionDetails.moduleCode} -{" "}
                                                                            {sessionData.sessionDetails.classGroupID}
                                                                        </h3>
                                                                        <p className="text-lg text-muted-foreground">
                                                                            {sessionData.sessionDetails.date} -{" "}
                                                                            {sessionData.sessionDetails.startTime} -{" "}
                                                                            {sessionData.sessionDetails.endTime}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <DataTableDemo
                                                                    data={sessionData.students}
                                                                    setLabSessions={setCurrentLabSessions}
                                                                    columns={columnsForTable}
                                                                />
                                                            </CardContent>
                                                        </Card>
                                                    )})
                                                )}
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </LabChecker>
                            {/*<button
                                onClick={() => {
                                setIsOpen(false);
                                // Optional: trigger any navigation or popup
                                }}
                                className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
                            >
                                Action Button
                            </button>*/}
                        </div>
                    </div>
            </div>

             {/* Tabs for View Switching */}
            <div className="bg-gray-100 px-10 py-3 shadow-md">
                {/*<Tabs defaultValue="current">
                    <div className="sticky top-0 text-black px-10 py-3 flex items-center justify-between shadow-lg relative">
                        
                        <div className="w-1/3"></div>

                        <div className="w-1/3 flex justify-center">
                            <TabsList className="flex space-x-4 items-center">
                                <TabsTrigger value="all" className="px-4 py-2 text-lg font-semibold">All Lab Rooms View</TabsTrigger>
                                <TabsTrigger value="specific" className="px-4 py-2 text-lg font-semibold">Specific Sessions View</TabsTrigger>                        
                            </TabsList>
                            </div>
                        
                    </div>*/}

                    {/*<TabsContent value="all">*/}
                        <div>
                            
                            <NetworkStatus isDown={isNetworkDown} />
                            <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold">{params.lab.toUpperCase()} (For All Rooms) - Scan Your ID</h2>
                                <div className="w-1/3 flex justify-end">
                                    <div className="text-3xl font-semibold">
                                        <Clock format={"LTS"} ticking={true} timezone={"Asia/Singapore"} />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                                {/* Left Section - Main Attendance Table (2/3 width) */}
                                <div className="col-span-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <button
                                            onClick={handleClick}
                                            className="bg-red-500 text-white px-2 py-2 rounded"
                                        >
                                            Manual Attendance Marking - Request for help
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-blue-500 text-white rounded"
                                            onClick={() => connectHID()}
                                            >
                                            Connect USB
                                         </button>
                                    </div>
                                    <form className={`${isManualVisible ? "block" : "hidden"} space-y-4`}>
                                        <div>
                                            <Label htmlFor="lab-id">Lab ID</Label>
                                            <Input
                                                id="lab-id"
                                                type="text"
                                                placeholder="Enter your username"
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
                                        <div className="flex gap-4">
                                            <Button type="button" onClick={handleIDCheck} className="w-full item left-item">
                                                Sign In
                                            </Button>
                                            <Button type="button" onClick={cancel} className="w-full item right-item">
                                                Cancel
                                            </Button>
                                        </div>
                                        
                                    </form>
                                    {/* Search Box */}                            
                                    <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Enter Student ID"
                                    className= {`${isVisible ? "block" : "hidden"} mb-4 p-2 border rounded w-full element`}
                                    />

                                    <div className={`${isVisible ? "block" : "hidden"} flex gap-4`}>                            
                                        <button
                                        onClick={handleAttendanceSubmit}
                                        className={`${isVisible ? "block" : "hidden"} mb-6 px-4 py-2 bg-blue-600 text-white rounded item left-item`}
                                        >
                                            Mark Attendance
                                        </button>

                                        <Button onClick={cancel} className={`${isVisible ? "block" : "hidden"} mb-6 px-4 py-2 item right-item`}>
                                                    Cancel
                                        </Button>
                                    </div>
                                    {/* Attendance Table */}
                                    <div className="max-h-[70vh] overflow-y-auto border rounded">
                                        <table className="w-full text-left border-collapse border">
                                            <thead className="sticky top-0">
                                                <tr className="bg-gray-100">
                                                <th className="p-2 border">Name</th>
                                                <th className="p-2 border">ID</th>
                                                <th className="p-2 border">Room</th>
                                                <th className="p-2 border">Seat Number</th>
                                                <th className="p-2 border">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {markedStudents.map((student) => {
                                                    const roomGroup = groupedByRoom[student.room] || [];
                                                    const indexInRoom = roomGroup.findIndex(s => s.id === student.id);

                                                    return (
                                                        <tr key={student.id} className="border-t">                                            
                                                        <td className="p-2 border">{student.name}</td>
                                                        <td className="p-2 border">{student.id}</td>
                                                        <td className="p-2 border">{student.room}</td>
                                                        <td className="p-2 border font-bold text-center">{indexInRoom + 1}</td>
                                                        <td className={`p-2 border ${getStatusColorClass(student.status)} font-semibold`}>{student.status}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Right Section - Temporary Student Detail Display */}
                                <div className={`fixed top-0 right-0 h-full w-1/3  shadow-lg p-6 transition-transform transform ${
                                    selectedStudent ? "translate-x-0" : "translate-x-full" } 
                                    ${selectedStudent ? getStatusBackgroundColor(selectedStudent.status) : ""}` }>
                                    {selectedStudent && (
                                    <div className="h-screen p-4 bg-green-100 rounded shadow-md flex flex-col justify-center items-center ">
                                        <h3 className="text-2xl font-bold mb-4">Student Marked</h3>
                                        <p className="text-xl"><strong>Name:</strong> {selectedStudent.name}</p>
                                        <p className="text-xl"><strong>ID:</strong> {selectedStudent.id}</p>
                                        <p className="text-xl"><strong>Room:</strong> {selectedStudent.room}</p>
                                        <p className="text-xl"><strong>Seat Number:</strong> {
                                            groupedByRoom[selectedStudent.room]?.findIndex(s => s.id === selectedStudent.id) + 1
                                        }</p>
                                        <p className="text-xl"><strong>Status:</strong> {selectedStudent.status}</p>
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    {/*</TabsContent>

                    <TabsContent value="specific">
                        
                    </TabsContent>

                </Tabs>*/}
            </div>
            </div>
        </div>
    );
}
