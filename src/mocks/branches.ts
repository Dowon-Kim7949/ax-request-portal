/**
 * Branches the demo pretends to read from a repository host. A real backend
 * asks the host (GitHub, GitLab) with its own credentials instead.
 */
import type { RepositoryBranches } from '../api/contract'

/** The seed projects' repositories; any other repository gets `main` and `develop`. */
const DEMO: Record<string, { defaultBranch: string; others: string[] }> = {
  'https://gitlab.example.com/acme/customer-portal': {
    defaultBranch: 'main',
    others: ['develop', 'release/2026.11', 'feature/notice-search'],
  },
  'https://github.com/acme/field-worker-app': {
    defaultBranch: 'main',
    others: ['develop', 'hotfix/offline-sync'],
  },
  'https://gitlab.example.com/acme/admin-console': { defaultBranch: 'master', others: ['develop'] },
  'https://github.com/acme/analytics-server': { defaultBranch: 'main', others: ['staging'] },
}

/** `https://host/owner/name(.git)(/)` → `https://host/owner/name` */
function canonical(url: string): string {
  return url.replace(/\/+$/, '').replace(/\.git$/, '')
}

/** The default branch first, then the rest by name: the order a backend answers in. */
export function demoBranches(url: string): RepositoryBranches {
  const { defaultBranch, others } = DEMO[canonical(url)] ?? { defaultBranch: 'main', others: ['develop'] }
  return {
    defaultBranch,
    branches: [
      defaultBranch,
      ...others.filter((b) => b !== defaultBranch).sort((a, b) => a.localeCompare(b)),
    ],
    truncated: false,
  }
}
