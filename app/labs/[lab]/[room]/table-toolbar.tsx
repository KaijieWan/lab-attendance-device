"use client";
import { Table } from "@tanstack/react-table";

import {
    CountdownTimerIcon,
    Cross2Icon,
    InfoCircledIcon,
    CheckCircledIcon,
    CrossCircledIcon,
    StopwatchIcon,
} from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps<TData> {
    table: Table<TData>;
}

export const statuses = [
    {
        value: "Pending",
        label: "Pending",
        icon: StopwatchIcon,
    },
    {
        value: "Late",
        label: "Late",
        icon: CountdownTimerIcon,
    },
    {
        value: "Present",
        label: "Present",
        icon: CheckCircledIcon,
    },
    {
        value: "Excused",
        label: "Excused",
        icon: InfoCircledIcon,
    },
    {
        value: "Absent",
        label: "Absent",
        icon: CrossCircledIcon,
    },
];

export function DataTableToolbar<TData>({ table }: DataTableToolbarProps<TData>) {
    const isFiltered = table.getState().columnFilters.length > 0;

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                <Input
                    placeholder="Search student..."
                    value={(table.getState().globalFilter as string) || ""}
                    onChange={(event) => table.setGlobalFilter(event.target.value)}
                    className="h-8 w-[150px] lg:w-[250px]"
                />

                {table.getColumn("status") && (
                    <DataTableFacetedFilter
                        column={table.getColumn("status")}
                        title="Attendance Status"
                        options={statuses}
                    />
                )}
                {isFiltered && (
                    <Button variant="ghost" onClick={() => table.resetColumnFilters()} className="h-8 px-2 lg:px-3">
                        Reset
                        <Cross2Icon className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
