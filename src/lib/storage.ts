import { mkdir, writeFile, unlink, access } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"

const UPLOADS_DIR = join(process.cwd(), "uploads")

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
])

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 200)
}

export async function saveFile(
  projectId: string,
  file: File,
): Promise<{ storedName: string; fileType: string; fileSize: number }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB`)
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`File type "${file.type}" is not allowed`)
  }

  const projectDir = join(UPLOADS_DIR, projectId)
  await mkdir(projectDir, { recursive: true })

  const sanitized = sanitizeFileName(file.name)
  const storedName = `${randomUUID()}_${sanitized}`
  const filePath = join(projectDir, storedName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  return {
    storedName,
    fileType: file.type,
    fileSize: file.size,
  }
}

export async function deleteFile(projectId: string, storedName: string): Promise<void> {
  const filePath = join(UPLOADS_DIR, projectId, storedName)
  try {
    await unlink(filePath)
  } catch {
    // File already deleted or doesn't exist — not an error
  }
}

export function getFilePath(projectId: string, storedName: string): string {
  return join(UPLOADS_DIR, projectId, storedName)
}

export async function fileExists(projectId: string, storedName: string): Promise<boolean> {
  try {
    await access(join(UPLOADS_DIR, projectId, storedName))
    return true
  } catch {
    return false
  }
}
