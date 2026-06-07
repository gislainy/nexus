'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { apiClient } from '@/lib/api-client'
import type { EntryMode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [entryMode, setEntryMode] = useState<EntryMode>('NEW_SYSTEM')
  const [nameError, setNameError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    // Validate every field up front so each invalid field shows its own message,
    // even when the form is submitted completely empty.
    const nextNameError =
      name.trim().length < 3
        ? 'O nome do projeto deve ter no mínimo 3 caracteres.'
        : null
    const nextDescriptionError =
      description.trim().length < 10
        ? 'A descrição deve ter no mínimo 10 caracteres.'
        : null

    setNameError(nextNameError)
    setDescriptionError(nextDescriptionError)

    if (nextNameError || nextDescriptionError) {
      return
    }

    setSubmitting(true)
    try {
      const { projectId } = await apiClient.projects.create({
        name: name.trim(),
        description: description.trim(),
        entryMode,
      })
      router.push(`/projects/${projectId}`)
      router.refresh()
    } catch {
      setFormError('Não foi possível criar o projeto. Tente novamente.')
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Novo projeto</h1>
        <Button variant="outline" asChild>
          <Link href="/projects">Voltar</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Criar projeto</CardTitle>
          <CardDescription>
            Descreva o sistema de saúde digital que será avaliado.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do projeto</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? 'name-error' : undefined}
              />
              {nameError && (
                <p id="name-error" className="text-sm text-destructive">
                  {nameError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={descriptionError ? true : undefined}
                aria-describedby={
                  descriptionError ? 'description-error' : undefined
                }
              />
              {descriptionError && (
                <p id="description-error" className="text-sm text-destructive">
                  {descriptionError}
                </p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Modo de entrada</legend>
              <label className="flex items-start gap-3 rounded-md border border-input p-3">
                <input
                  type="radio"
                  name="entryMode"
                  value="EXISTING_SYSTEM"
                  checked={entryMode === 'EXISTING_SYSTEM'}
                  onChange={() => setEntryMode('EXISTING_SYSTEM')}
                  className="mt-1"
                />
                <span className="text-sm">O sistema já existe</span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-input p-3">
                <input
                  type="radio"
                  name="entryMode"
                  value="NEW_SYSTEM"
                  checked={entryMode === 'NEW_SYSTEM'}
                  onChange={() => setEntryMode('NEW_SYSTEM')}
                  className="mt-1"
                />
                <span className="text-sm">O sistema ainda está sendo concebido</span>
              </label>
            </fieldset>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar projeto'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
