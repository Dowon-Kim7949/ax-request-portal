import * as z from 'zod'

/**
 * Every schema that is part of the public API contract is registered here
 * under a stable id. `src/api/openapi.ts` turns this registry into
 * `components.schemas` of the generated OpenAPI document, so the id is the
 * name a backend implementer sees.
 */
export const contractRegistry = z.registry<{ id: string; description?: string }>()

/** id → description, so the OpenAPI generator can attach descriptions to components. */
export const contractDescriptions = new Map<string, string>()

export function named<T extends z.ZodType>(id: string, schema: T, description?: string): T {
  contractRegistry.add(schema, description ? { id, description } : { id })
  if (description) contractDescriptions.set(id, description)
  return schema
}
