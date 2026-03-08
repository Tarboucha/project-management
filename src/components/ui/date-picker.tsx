"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  name?: string
  value?: Date
  defaultValue?: string
  onChange?: (date: Date | undefined) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  fromYear?: number
  toYear?: number
}

export function DatePicker({
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  disabled,
  placeholder = "Pick a date",
  className,
  fromYear = 2020,
  toYear = 2035,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(() => {
    if (controlledValue) return controlledValue
    if (defaultValue) {
      const parsed = parse(defaultValue, "yyyy-MM-dd", new Date())
      return isNaN(parsed.getTime()) ? undefined : parsed
    }
    return undefined
  })

  const date = controlledValue ?? internalDate

  const handleSelect = (selected: Date | undefined) => {
    if (!controlledValue) {
      setInternalDate(selected)
    }
    onChange?.(selected)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={date ? format(date, "yyyy-MM-dd") : ""}
        />
      )}
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!date}
          className={cn(
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          defaultMonth={date}
          captionLayout="dropdown"
          fromYear={fromYear}
          toYear={toYear}
        />
      </PopoverContent>
    </Popover>
  )
}
