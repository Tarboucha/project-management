"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Check, PlusCircle } from "lucide-react"
import { api } from "@/lib/utils/api-client"
import type { CursorPaginatedResult } from "@/types/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

interface LookupOption {
  id: string
  name: string
  _count?: { projects: number }
}

interface FacetedFilterProps {
  title: string
  apiPath: string
  selected: string[]
  onSelectionChange: (ids: string[]) => void
}

export function FacetedFilter({
  title,
  apiPath,
  selected,
  onSelectionChange,
}: FacetedFilterProps) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<LookupOption[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchOptions = useCallback(async (searchTerm: string) => {
    setIsLoading(true)
    const params = new URLSearchParams()
    params.set("isActive", "true")
    params.set("limit", "50")
    if (searchTerm) params.set("search", searchTerm)

    const res = await api.get(`${apiPath}?${params}`)
    if (res.success) {
      const paginated = res as CursorPaginatedResult<LookupOption>
      setOptions(paginated.data)
    }
    setIsLoading(false)
  }, [apiPath])

  useEffect(() => {
    if (!open) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchOptions(search)
    }, search ? 300 : 0)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [open, search, fetchOptions])

  // Accumulate names from loaded options so badges display correctly
  useEffect(() => {
    setSelectedNames((prev) => {
      const next = { ...prev }
      for (const opt of options) {
        next[opt.id] = opt.name
      }
      return next
    })
  }, [options])

  const toggleOption = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id]
    onSelectionChange(next)
  }

  const selectedCount = selected.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedCount > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {selectedCount}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading..." : "No results found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.id)
                return (
                  <CommandItem
                    key={option.id}
                    onSelect={() => toggleOption(option.id)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    <span className="flex-1 truncate">{option.name}</span>
                    {option._count && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {option._count.projects}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
          {selectedCount > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => onSelectionChange([])}
                  className="justify-center text-center"
                >
                  Clear filters
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
