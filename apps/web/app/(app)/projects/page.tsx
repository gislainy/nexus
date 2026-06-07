'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { apiClient } from '@/lib/api-client'
import type { ProjectListItem, SessionStatus, UserRole } from '@/lib/types'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  IN_PROGRESS: 'Em andamento',
  SUFFICIENT: 'Perguntas suficientes',
  AWAITING_DELEGATION: 'Aguardando resposta de colaborador',
  READY_FOR_ARGUMENTATION: 'Pronto para avaliação final',
  COMPLETED: 'Avaliação concluída',
}

const USER_ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Responsável',
  COLLABORATOR: 'Colaborador',
}

export default function ProjectsPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<ProjectListItem[]>([])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        if (!useAuthStore.getState().user) {
          const loaded = await apiClient.auth.me()
          if (!active) {
            return
          }
          setUser(loaded)
        }
        const { projects: loadedProjects } = await apiClient.projects.list()
        if (active) {
          setProjects(loadedProjects)
        }
      } catch {
        if (active) {
          router.push('/login')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    bootstrap()
    return () => {
      active = false
    }
  }, [setUser, router])

  async function onLogout() {
    await apiClient.auth.logout()
    setUser(null)
    router.push('/login')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {loading ? 'Carregando...' : `Bem-vindo, ${user?.name ?? ''}`}
        </h1>
        <Button variant="outline" onClick={onLogout}>
          Sair
        </Button>
      </header>

      {!loading && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Seus projetos</h2>
            <Button asChild>
              <Link href="/projects/new">Criar projeto</Link>
            </Button>
          </div>

          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-4 p-6">
                <p className="text-muted-foreground">
                  Você ainda não tem projetos. Crie o primeiro para começar.
                </p>
                <Button asChild>
                  <Link href="/projects/new">Criar projeto</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {projects.map((project) => (
                <li key={project.projectId}>
                  <Link href={`/projects/${project.projectId}`}>
                    <Card className="transition-colors hover:bg-accent">
                      <CardHeader>
                        <CardTitle className="text-base">
                          {project.name}
                        </CardTitle>
                        <CardDescription>
                          {SESSION_STATUS_LABELS[project.sessionStatus]} ·{' '}
                          {USER_ROLE_LABELS[project.userRole]}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}
