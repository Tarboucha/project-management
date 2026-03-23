"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FileDown, FileText, FileSpreadsheet } from "lucide-react"

interface ExportMenuProps {
  pdfUrl: string
  csvUrl?: string
}

export function ExportMenu({ pdfUrl, csvUrl }: ExportMenuProps) {
  if (!csvUrl) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
          <FileDown className="mr-2 h-4 w-4" />
          PDF
        </a>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <FileText className="mr-2 h-4 w-4" />
            PDF Report
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={csvUrl} target="_blank" rel="noopener noreferrer">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            CSV Export
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
