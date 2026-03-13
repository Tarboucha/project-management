"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
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

function todayStr() {
  return format(new Date(), "yyyy-MM-dd")
}

export function DatePicker({
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  required,
  disabled,
  placeholder = "dd/mm/yyyy",
  className,
  fromYear = 2020,
  toYear = 2035,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const initialDate = React.useMemo(() => {
    if (controlledValue) return controlledValue
    if (defaultValue) {
      const parsed = parse(defaultValue, "yyyy-MM-dd", new Date())
      return isValid(parsed) ? parsed : undefined
    }
    return undefined
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [internalDate, setInternalDate] = React.useState<Date | undefined>(initialDate)
  const [inputValue, setInputValue] = React.useState(() => {
    const d = controlledValue ?? initialDate
    return d ? format(d, "dd/MM/yyyy") : ""
  })

  const date = controlledValue ?? internalDate

  const updateDate = (newDate: Date | undefined) => {
    if (!controlledValue) {
      setInternalDate(newDate)
    }
    setInputValue(newDate ? format(newDate, "dd/MM/yyyy") : "")
    onChange?.(newDate)
  }

  const handleCalendarSelect = (selected: Date | undefined) => {
    updateDate(selected)
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputValue(raw)

    if (raw === "") {
      if (!controlledValue) setInternalDate(undefined)
      onChange?.(undefined)
      return
    }

    // Try parsing dd/mm/yyyy
    const parsed = parse(raw, "dd/MM/yyyy", new Date())
    if (isValid(parsed) && raw.length === 10) {
      if (!controlledValue) setInternalDate(parsed)
      onChange?.(parsed)
    }
  }

  const handleInputBlur = () => {
    // On blur, reformat to show the current date or clear invalid input
    if (date) {
      setInputValue(format(date, "dd/MM/yyyy"))
    } else {
      setInputValue("")
    }
  }

  return (
    <div className={cn("flex gap-1", className)}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={date ? format(date, "yyyy-MM-dd") : ""}
        />
      )}
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        disabled={disabled}
        required={required}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className="shrink-0"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleCalendarSelect}
            defaultMonth={date}
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
