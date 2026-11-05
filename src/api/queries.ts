/**
 * TanStack Query hooks — the only way screens talk to the API.
 * Keys are centralised so mutations can invalidate precisely.
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import type { TransitionCommand } from '../domain/lifecycle'
import type { Notification, RequestStatus, WorkRequest } from '../domain/model'
import { useSession } from '../stores/session'
import { call } from './client'
import { api, type BodyOf, type ParamsOf, type QueryOf } from './contract'

export const keys = {
  all: ['api'] as const,
  me: () => [...keys.all, 'me'] as const,
  users: () => [...keys.all, 'users'] as const,
  projects: () => [...keys.all, 'projects'] as const,
  requests: () => [...keys.all, 'requests'] as const,
  requestList: (query: QueryOf<typeof api.listRequests>) => [...keys.requests(), 'list', query] as const,
  request: (id: number) => [...keys.requests(), 'detail', id] as const,
  regression: () => [...keys.requests(), 'regression'] as const,
  notifications: () => [...keys.all, 'notifications'] as const,
  notificationSettings: () => [...keys.all, 'notification-settings'] as const,
  dashboard: (month?: string) => [...keys.all, 'dashboard', month ?? 'current'] as const,
  releases: (from?: string, to?: string) => [...keys.all, 'releases', from, to] as const,
  budget: () => [...keys.all, 'budget'] as const,
  aiSettings: () => [...keys.all, 'ai', 'settings'] as const,
  aiPricing: () => [...keys.all, 'ai', 'pricing'] as const,
  aiUsage: (month?: string) => [...keys.all, 'ai', 'usage', month ?? 'current'] as const,
}

/** Statuses in which the AI is working, so the screen should refresh by itself. */
const LIVE_STATUSES: readonly RequestStatus[] = ['submitted', 'reporting', 'in_progress']
export const LIVE_POLL_MS = 2_000

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function useMe() {
  const token = useSession((s) => s.token)
  return useQuery({
    queryKey: keys.me(),
    queryFn: ({ signal }) => call(api.me, { signal }),
    enabled: !!token,
  })
}

export function useUsers() {
  return useQuery({
    queryKey: keys.users(),
    queryFn: ({ signal }) => call(api.listUsers, { signal }),
    staleTime: 60_000,
  })
}

export function useProjects() {
  return useQuery({
    queryKey: keys.projects(),
    queryFn: ({ signal }) => call(api.listProjects, { signal }),
    staleTime: 60_000,
  })
}

export function useRequests(query: QueryOf<typeof api.listRequests>, options: { live?: boolean } = {}) {
  return useQuery({
    queryKey: keys.requestList(query),
    queryFn: ({ signal }) => call(api.listRequests, { query, signal }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      options.live || q.state.data?.some((r) => LIVE_STATUSES.includes(r.status)) ? LIVE_POLL_MS * 2 : false,
  })
}

export function useRequest(id: number | undefined) {
  return useQuery({
    queryKey: keys.request(id ?? 0),
    queryFn: ({ signal }) => call(api.getRequest, { params: { id: id! }, signal }),
    enabled: id !== undefined && Number.isInteger(id) && id > 0,
    refetchInterval: (q) =>
      q.state.data && LIVE_STATUSES.includes(q.state.data.status) ? LIVE_POLL_MS : false,
  })
}

export function useRegressionQueue() {
  return useQuery({
    queryKey: keys.regression(),
    queryFn: ({ signal }) => call(api.regressionQueue, { signal }),
  })
}

export function useNotifications() {
  const token = useSession((s) => s.token)
  return useQuery({
    queryKey: keys.notifications(),
    queryFn: ({ signal }) => call(api.listNotifications, { signal }),
    enabled: !!token,
    refetchInterval: 15_000,
  })
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: keys.notificationSettings(),
    queryFn: ({ signal }) => call(api.getNotificationSettings, { signal }),
  })
}

export function useDashboard(month?: string) {
  return useQuery({
    queryKey: keys.dashboard(month),
    queryFn: ({ signal }) => call(api.dashboard, { query: { month }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useReleases(from?: string, to?: string) {
  return useQuery({
    queryKey: keys.releases(from, to),
    queryFn: ({ signal }) => call(api.releases, { query: { from, to }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useBudget() {
  return useQuery({ queryKey: keys.budget(), queryFn: ({ signal }) => call(api.getBudget, { signal }) })
}

export function useAiSettings() {
  return useQuery({
    queryKey: keys.aiSettings(),
    queryFn: ({ signal }) => call(api.getAiSettings, { signal }),
  })
}

/** The price table; `enabled: false` for people who may not read it (they fall back to the defaults). */
export function useAiPricing(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.aiPricing(),
    queryFn: ({ signal }) => call(api.getAiPricing, { signal }),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  })
}

export function useAiUsage(month?: string) {
  return useQuery({
    queryKey: keys.aiUsage(month),
    queryFn: ({ signal }) => call(api.aiUsage, { query: { month }, signal }),
    placeholderData: keepPreviousData,
  })
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

/**
 * Stores a copy of a request unless the cache already holds a newer one:
 * answers can arrive out of order (a slow save after a quick decision, or a
 * poll that overtook the answer).
 */
function storeRequest(qc: QueryClient, req: WorkRequest) {
  qc.setQueryData<WorkRequest>(keys.request(req.id), (cached) =>
    cached && Date.parse(cached.updatedAt) > Date.parse(req.updatedAt) ? cached : req,
  )
}

/**
 * Changes to one request run one after another (TanStack mutation scope), so
 * the server applies them in the order the person made them.
 */
const requestScope = (id: number) => ({ id: `request:${id}` })

/** After any change to a request: store the fresh copy, refresh lists and notifications. */
function onRequestChanged(qc: QueryClient, req: WorkRequest) {
  storeRequest(qc, req)
  void qc.invalidateQueries({ queryKey: [...keys.requests(), 'list'] })
  void qc.invalidateQueries({ queryKey: keys.regression() })
  void qc.invalidateQueries({ queryKey: keys.notifications() })
  void qc.invalidateQueries({ queryKey: [...keys.all, 'dashboard'] })
  void qc.invalidateQueries({ queryKey: [...keys.all, 'releases'] })
}

export function useLogin() {
  const setSession = useSession((s) => s.setSession)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.login>) => call(api.login, { body }),
    onSuccess: (session) => {
      qc.clear()
      setSession(session)
    },
  })
}

/** Signing out on purpose: the login screen then starts fresh, without `next` (see RequireAuth). */
export function useLogout() {
  const clear = useSession((s) => s.clear)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => call(api.logout),
    onSettled: () => {
      qc.clear()
      clear('signedOut')
    },
  })
}

export function usePrecheck() {
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.precheckRequest>) => call(api.precheckRequest, { body }),
  })
}

/**
 * `onCreated` / `onFailed` run with the hook's own handling, so they run even
 * when the screen that submitted has been left meanwhile (per-call `mutate`
 * callbacks are dropped on unmount). The wizard deletes its draft there.
 */
export function useCreateRequest(
  options: { onCreated?: (req: WorkRequest) => void; onFailed?: (error: Error) => void } = {},
) {
  const qc = useQueryClient()
  const { onCreated, onFailed } = options
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.createRequest>) => call(api.createRequest, { body }),
    onSuccess: (req) => {
      onRequestChanged(qc, req)
      onCreated?.(req)
    },
    onError: onFailed,
  })
}

export function useTransition(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TransitionCommand) => call(api.transitionRequest, { params: { id }, body }),
    scope: requestScope(id),
    onSuccess: (req) => onRequestChanged(qc, req),
  })
}

/** The checklist save each request's most recent call got, so earlier answers do not overwrite it */
let verificationSaves = 0
const latestVerificationSave = new Map<number, number>()

/**
 * Saves checklist progress on every tap. Saves run one at a time (shared
 * request scope) and only the answer to the most recent one is stored, so a
 * late answer cannot bring back an earlier state of the checklist.
 */
export function useSaveVerification(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.saveVerification>) =>
      call(api.saveVerification, { params: { id }, body }),
    scope: requestScope(id),
    onMutate: () => {
      const seq = ++verificationSaves
      latestVerificationSave.set(id, seq)
      return { seq }
    },
    onSuccess: (req, _body, ctx) => {
      if (ctx.seq === latestVerificationSave.get(id)) storeRequest(qc, req)
    },
    onSettled: (_req, error, _body, ctx) => {
      if (ctx?.seq !== latestVerificationSave.get(id)) return
      latestVerificationSave.delete(id)
      // Earlier answers were skipped: after a failed last save, read the request again.
      if (error) void qc.invalidateQueries({ queryKey: keys.request(id) })
      void qc.invalidateQueries({ queryKey: [...keys.requests(), 'list'] })
    },
  })
}

export function usePreviewFeedback(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.sendPreviewFeedback>) =>
      call(api.sendPreviewFeedback, { params: { id }, body }),
    scope: requestScope(id),
    onSuccess: (req) => onRequestChanged(qc, req),
  })
}

export function useUpdateRegression(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.updateRegression>) =>
      call(api.updateRegression, { params: { id }, body }),
    scope: requestScope(id),
    onSuccess: (req) => onRequestChanged(qc, req),
  })
}

export function useUpdateRelease(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.updateRelease>) => call(api.updateRelease, { params: { id }, body }),
    scope: requestScope(id),
    onSuccess: (req) => onRequestChanged(qc, req),
  })
}

export function useUploadAttachment() {
  return useMutation({ mutationFn: (file: File) => call(api.uploadAttachment, { file }) })
}

export function useSaveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: BodyOf<typeof api.createProject> }) =>
      id ? call(api.updateProject, { params: { id }, body }) : call(api.createProject, { body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.projects() }),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.createUser>) => call(api.createUser, { body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.users() }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: BodyOf<typeof api.updateUser> }) =>
      call(api.updateUser, { params: { id }, body }),
    onSuccess: (_user, { id }) => {
      void qc.invalidateQueries({ queryKey: keys.users() })
      // Changing yourself (e.g. a template that lets admins edit their own team): refresh the session's copy.
      if (id === useSession.getState().user?.id) void qc.invalidateQueries({ queryKey: keys.me() })
    },
  })
}

/**
 * Marks one notification (or all) as read at once — list and bell badge — and
 * puts back exactly those it marked if the server refuses. `onError` runs even
 * after the screen is left (opening a notification navigates away).
 */
export function useMarkNotificationRead(options: { onError?: (error: Error) => void } = {}) {
  const qc = useQueryClient()
  const { onError } = options
  return useMutation({
    mutationFn: async (id: string | 'all'): Promise<void> => {
      if (id === 'all') await call(api.markAllNotificationsRead)
      else await call(api.markNotificationRead, { params: { id } })
    },
    onMutate: async (id) => {
      // A poll in flight would answer with the old read state.
      await qc.cancelQueries({ queryKey: keys.notifications() })
      const marked = new Set<string>()
      const readAt = new Date().toISOString()
      qc.setQueryData<Notification[]>(keys.notifications(), (list) =>
        list?.map((n) => {
          if (n.readAt || (id !== 'all' && n.id !== id)) return n
          marked.add(n.id)
          return { ...n, readAt }
        }),
      )
      return { marked }
    },
    onError: (error, _id, ctx) => {
      if (ctx?.marked.size) {
        qc.setQueryData<Notification[]>(keys.notifications(), (list) =>
          list?.map((n) => {
            if (!ctx.marked.has(n.id)) return n
            const { readAt: _readAt, ...unread } = n
            return unread
          }),
        )
      }
      onError?.(error)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.notifications() }),
  })
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.updateNotificationSettings>) =>
      call(api.updateNotificationSettings, { body }),
    onSuccess: (settings) => qc.setQueryData(keys.notificationSettings(), settings),
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.updateBudget>) => call(api.updateBudget, { body }),
    onSuccess: (budget) => {
      qc.setQueryData(keys.budget(), budget)
      void qc.invalidateQueries({ queryKey: [...keys.all, 'dashboard'] })
      void qc.invalidateQueries({ queryKey: [...keys.all, 'ai', 'usage'] })
    },
  })
}

export function useUpdateAiSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.updateAiSettings>) => call(api.updateAiSettings, { body }),
    onSuccess: (settings) => qc.setQueryData(keys.aiSettings(), settings),
  })
}

export function useSetProviderKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      provider,
      apiKey,
    }: ParamsOf<typeof api.setProviderKey> & BodyOf<typeof api.setProviderKey>) =>
      call(api.setProviderKey, { params: { provider }, body: { apiKey } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.aiSettings() }),
  })
}

export function useRemoveProviderKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (provider: ParamsOf<typeof api.removeProviderKey>['provider']) =>
      call(api.removeProviderKey, { params: { provider } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.aiSettings() }),
  })
}

export function useUpdateAiPricing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BodyOf<typeof api.updateAiPricing>) => call(api.updateAiPricing, { body }),
    onSuccess: (pricing) => {
      qc.setQueryData(keys.aiPricing(), pricing)
      // The usage report shows the current rate and price date.
      void qc.invalidateQueries({ queryKey: [...keys.all, 'ai', 'usage'] })
    },
  })
}
