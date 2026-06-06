'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

export default function ProjectDashboardPage() {
  const params = useParams<{ projectId: string }>()

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projeto</h1>
        <Button variant="outline" asChild>
          <Link href="/projects">Voltar</Link>
        </Button>
      </header>
      <p className="text-muted-foreground">
        O painel deste projeto ainda será implementado.
      </p>
      <p className="text-xs text-muted-foreground">ID: {params.projectId}</p>
    </main>
  )
}
