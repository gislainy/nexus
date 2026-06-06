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
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (name.trim().length < 3) {
      setError('O nome do projeto deve ter no mínimo 3 caracteres.')
      return
    }
    if (description.trim().length < 10) {
      setError('A descrição deve ter no mínimo 10 caracteres.')
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
      setError('Não foi possível criar o projeto. Tente novamente.')
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
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
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

            {error && <p className="text-sm text-destructive">{error}</p>}
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
