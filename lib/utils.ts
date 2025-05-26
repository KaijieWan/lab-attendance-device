import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

declare global {
  interface Navigator {
    serial: Serial;
    usb: any;
    //hid: any;
  }

  interface Serial {
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  }

  interface SerialPort {
    open(options: SerialOptions): Promise<void>;
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
    close(): Promise<void>;
  }

  interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: "none" | "even" | "odd";
    bufferSize?: number;
    flowControl?: "none" | "hardware";
  }

  interface SerialPortRequestOptions {
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
  }

  // webhid.d.ts
  interface USBHIDInputReport {
    data: DataView; // or a more specific type depending on your report
  }

  interface HIDDevice {
    open(): Promise<void>;
    close(): Promise<void>;
    addEventListener(event: "inputreport", callback: (event: Event) => void): void;
  }

  interface Navigator {
    hid: {
      requestDevice(options: { filters: Array<{ vendorId: number }> }): Promise<HIDDevice[]>;
    };
  }

}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// extract only date with start time a lab session ID
export const extractLabSessionDateWithStartTime = (labSessionID: string) => {
  const parts = labSessionID.split('-');
  
  const moduleCode = parts[0];
  const classGroup = parts[1];
  const labName = parts[2];
  const labRoom = parts[3];
  const week = parseInt(parts[4]);
  const dayOfWeek = parts[5];
  const date = new Date(`${parts[6]}-${parts[7]}-${parts[8]}`);
  const startTime = parts[9];
  const endTime = parts[10];
  
  // Extract hours and minutes from startTime
  const hours = parseInt(startTime.substring(0, 2), 10);
  const minutes = parseInt(startTime.substring(2, 4), 10);

  // Set the hours and minutes on the date object
  date.setHours(hours);
  date.setMinutes(minutes);

  return {
      date,
  };
};

export async function connectSerial() {
  if (!("serial" in navigator)) {
    console.error("Web Serial API not supported in this browser.");
    alert("Your browser does not support Web Serial API. Please use Chrome or Edge.");
    return;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 }); // Adjust baudRate if your device uses something different

    const reader = port.readable?.getReader();
    
    if (!reader) {
      console.error("No reader available on the serial port.");
      return;
    }

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.log("Reader disconnected");
        reader.releaseLock();
        break;
      }
      if (value) {
        const text = new TextDecoder().decode(value);
        console.log("RFID/NFC Data:", text.trim()); // trim() to remove weird line breaks
        return text.trim();
      }
    }
  } catch (error) {
    console.error("Error connecting to serial device:", error);
  }
}

import { useState, useEffect } from "react";

export function useSerial() {
  const [port, setPort] = useState<SerialPort | null>(null);
  const [reader, setReader] = useState<ReadableStreamDefaultReader<string> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] = useState<string>("");

  const connect = async () => {
    if (!("serial" in navigator)) {
      alert("Web Serial API not supported in this browser.");
      return;
    }

    try {
      const selectedPort = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x0581, usbProductId: 0x011a },
        ],
      });

      await selectedPort.open({ baudRate: 9600 }); // set your device's baudRate
      setPort(selectedPort);
      setIsConnected(true);
      console.log("Serial connected!");

      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = selectedPort.readable?.pipeTo(textDecoder.writable);
      const textReader = textDecoder.readable.getReader();
      setReader(textReader);

      readLoop(textReader);
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  const disconnect = async () => {
    try {
      reader?.cancel();
      await port?.close();
      setPort(null);
      setReader(null);
      setIsConnected(false);
      console.log("Serial disconnected!");
    } catch (err) {
      console.error("Disconnection error:", err);
    }
  };

  const readLoop = async (textReader: ReadableStreamDefaultReader<string>) => {
    try {
      while (true) {
        const { value, done } = await textReader.read();
        if (done) {
          console.log("Reader closed");
          break;
        }
        if (value) {
          console.log("Received:", value);
          setReceivedData((prev) => prev + value); // appends data
        }
      }
    } catch (err) {
      console.error("Read loop error:", err);
    }
  };

  useEffect(() => {
    // Cleanup when component unmounts
    return () => {
      disconnect();
    };
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
    receivedData,
  };
}

interface USBDeviceInfo {
  vendorId: number;
  productId: number;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
}

export async function connectHID() {
  if (!("hid" in navigator)) {
    alert("WebHID not supported in this browser.");
    return;
  }

  try {
    const devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: 1409 }] // Adjust this filter as necessary for your RFID reader
    });
    

    if (devices.length === 0) {
      console.log("No HID device selected.");
      return;
    }

    const device = devices[0];
    console.log("RFID Device selected:", device);

    


    await device.open();
    console.log("RFID Device opened");

    device.addEventListener("inputreport", (event: Event) => {
      console.log("Input Report Event Triggered:", event);
      const inputReport = (event as CustomEvent).detail;
      console.log("Received input report:", inputReport);
      processInputReport(inputReport);
    });

  } catch (err) {
    console.error("HID Connection failed:", err);
  }
}

function processInputReport(report: USBHIDInputReport) {
  const reportData = new Uint8Array(report.data.buffer);
  console.log("Raw report data:", reportData);

  // Assuming the RFID UID is the first few bytes in the report
  const uid = Array.from(reportData.slice(0, 8)).map(byte => byte.toString(16).padStart(2, "0")).join("-");
  console.log("RFID Tag UID:", uid);
}







