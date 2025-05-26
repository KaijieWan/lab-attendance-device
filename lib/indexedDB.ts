import { SessionData } from "@/app/labs/[lab]/[room]/page";
import { openDB, DBSchema, IDBPDatabase } from "idb";
import { Student } from "@/app/labs/[lab]/[room]/page";

interface MarkedStudent {
  id: string;
  name: string;
  room: string;
  seatNumber?: string; 
  status: string;
}
interface MyDB extends DBSchema {
  labSessions: {
    key: string;
    value: SessionData;
  };
  pendingActions: {
    key: number;
    value: PendingAction;
    indexes: { "by-type": string };
  };
  markedStudents: {
    key: string; //student ID
    value: Student;
  };
}

let dbPromise: Promise<IDBPDatabase<MyDB>>;

export const initDB = () => {
  dbPromise = openDB<MyDB>("MyPWADatabase", 2, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        db.createObjectStore("labSessions", { keyPath: "sessionDetails.lab_SessionID" });
        const pendingStore = db.createObjectStore("pendingActions", { keyPath: "id", autoIncrement: true });
        pendingStore.createIndex("by-type", "type");
      }
      if (oldVersion < 2) {
        db.createObjectStore("markedStudents", { keyPath: "id" });
      }
    }
  });
  return dbPromise;
};

export const getLabSessions = async (): Promise<SessionData[]> => {
  const db = await dbPromise;
  return db.getAll("labSessions");
};

export const addLabSession = async (session: SessionData): Promise<void> => {
  const db = await dbPromise;
  await db.put("labSessions", session);
};

export const clearLabSessions = async (): Promise<void> => {
    const db = await dbPromise;
    const tx = db.transaction('labSessions', 'readwrite');
    await tx.objectStore('labSessions').clear();
    await tx.done;
};
  

export const updateLabSession = async (session: SessionData): Promise<void> => {
  const db = await dbPromise;
  await db.put("labSessions", session);
};

export const getPendingActions = async (): Promise<PendingAction[]> => {
  const db = await dbPromise;
  return db.getAll("pendingActions");
};

export const addPendingAction = async (action: PendingAction): Promise<number> => {
  const db = await dbPromise;
  return db.add("pendingActions", action);
};

export const deletePendingAction = async (id: number): Promise<void> => {
  const db = await dbPromise;
  await db.delete("pendingActions", id);
};

export const getMarkedStudents = async (): Promise<Student[]> => {
  const db = await dbPromise;
  return db.getAll("markedStudents");
};

export const addMarkedStudent = async (student: Student): Promise<void> => {
  const db = await dbPromise;
  await db.put("markedStudents", student);
};

export const clearMarkedStudents = async (): Promise<void> => {
  const db = await dbPromise;
  const tx = db.transaction('markedStudents', 'readwrite');
  await tx.objectStore('markedStudents').clear();
  await tx.done;
};

export interface PendingAction {
  id?: number;
  type: string;
  data: any;
}
