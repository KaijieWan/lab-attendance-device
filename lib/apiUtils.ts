const API_BASE_URL =
  typeof window === "undefined"
    ? "http://localhost:8081" // Server-side (e.g., Next.js authorize() call on VM)
    : "http://10.96.188.181:8081"; // Browser-side

//const API_BASE_URL = "http://localhost:8081";

export const FRONTEND_BASE_URL = process.env.NEXT_PUBLIC_FRONTEND_BASE_URL || "http://localhost:3001";

interface FetchOptions extends RequestInit {
  timeout?: number;
}

async function fetchWithTimeout(resource: RequestInfo, options: FetchOptions = {}) {
  const { timeout = 5000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);

  return response;
}

export async function authenticateUser(username: string, password: string) {
    console.log("Sending request to:", API_BASE_URL);
    const res = await fetch(`${API_BASE_URL}` + "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: { "Content-Type": "application/json" },
    });

    return res;
}

export const fetchLabSessions = async (
  labName: string,
  room: number,
  currentTime: string,
  currentDate: string,
  jwtToken: string
) => {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/attendance/labSessionsToEndOfDay`,
      {
        method: "POST",
        headers: {
          accept: "*/*",
          Authorization: `Bearer ${jwtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          labName,
          room,
          currentTime,
          currentDate,
        }),
        timeout: 8000,
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
};

export const markAttendance = async (
  attendanceID: string,
  status: string,
  jwtToken: string
) => {
  try {
    if (!navigator.onLine) {
      throw new Error("No internet connection");
    }

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/attendance/markAttendance`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ attendanceID, status }),
        timeout: 8000,
      }
    );

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const jsonData = await response.json();
    return jsonData;
  } catch (error) {
    throw error;
  }
};
