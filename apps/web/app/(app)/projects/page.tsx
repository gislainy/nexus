'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'

export default function ProjectsPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [loading, setLoading] = useState(!user)

  useEffect(() => {
    if (user) {
      return
    }
    let active = true
    apiClient.auth
      .me()
      .then((loaded) => {
        if (active) {
          setUser(loaded)
        }
      })
      .catch(() => {
        router.push('/login')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [user, setUser, router])

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
      <p className="text-muted-foreground">Seus projetos aparecerão aqui.</p>
    </main>
  )
}
