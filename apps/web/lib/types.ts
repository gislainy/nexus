export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthUser {
  userId: string
  name: string
  email: string
}

export type SessionStatus =
  | 'IN_PROGRESS'
  | 'SUFFICIENT'
  | 'AWAITING_DELEGATION'
  | 'READY_FOR_ARGUMENTATION'
  | 'COMPLETED'

export type UserRole = 'OWNER' | 'COLLABORATOR'

export type EntryMode = 'EXISTING_SYSTEM' | 'NEW_SYSTEM'

export interface ProjectListItem {
  projectId: string
  name: string
  sessionStatus: SessionStatus
  userRole: UserRole
}

export interface ProjectListResponse {
  projects: ProjectListItem[]
}

export interface CreateProjectInput {
  name: string
  description: string
  entryMode: EntryMode
}

export interface CreateProjectResponse {
  projectId: string
  sessionId: string
  createdAt: string
}
