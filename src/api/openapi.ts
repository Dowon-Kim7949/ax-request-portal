import * as z from 'zod'
import { contractDescriptions, contractRegistry } from '../domain/registry'
import { ApiErrorBody, api, type EndpointSpec } from './contract'

type JsonSchema = Record<string, unknown>

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` })

function idOf(schema: z.ZodType, where: string): string {
  const id = contractRegistry.get(schema)?.id
  if (!id) throw new Error(`${where}: schema is not registered with named(). Register it in the contract.`)
  return id
}

/** Peels optional/default wrappers, collecting a default value on the way. */
function unwrap(schema: z.ZodType): { inner: z.ZodType; defaultValue?: unknown } {
  let inner = schema
  let defaultValue: unknown
  for (;;) {
    const def = inner.def as { type: string; innerType?: z.ZodType; defaultValue?: unknown }
    if ((def.type === 'optional' || def.type === 'default') && def.innerType) {
      if (def.type === 'default') defaultValue = def.defaultValue
      inner = def.innerType
    } else {
      return { inner, defaultValue }
    }
  }
}

/** Parameter schema: a $ref when the field is a contract schema, otherwise inlined. */
function parameterSchema(schema: z.ZodType): JsonSchema {
  const { inner, defaultValue } = unwrap(schema)
  const id = contractRegistry.get(inner)?.id
  if (id) return { ...ref(id), ...(defaultValue !== undefined ? { default: defaultValue } : {}) }
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema
  delete json.$schema
  return json
}

function parameters(e: EndpointSpec): JsonSchema[] {
  const out: JsonSchema[] = []
  for (const [where, obj] of [
    ['path', e.params],
    ['query', e.query],
  ] as const) {
    if (!obj) continue
    for (const [name, field] of Object.entries(obj.shape)) {
      const schema = parameterSchema(field as z.ZodType)
      const description =
        typeof schema.description === 'string' ? schema.description : (field as z.ZodType).description
      delete schema.description
      out.push({
        name,
        in: where,
        required: where === 'path' || !(field as z.ZodType).safeParse(undefined).success,
        ...(description ? { description } : {}),
        schema,
      })
    }
  }
  return out
}

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref(idOf(ApiErrorBody, 'ApiError')) } },
})

function operation(name: string, e: EndpointSpec): JsonSchema {
  const responses: JsonSchema = {}
  if (e.response) {
    responses[String(e.status ?? 200)] = {
      description: 'OK',
      content: { 'application/json': { schema: ref(idOf(e.response, `${name}.response`)) } },
    }
  } else {
    responses['204'] = { description: 'No Content' }
  }
  if (e.body || e.params || e.query || e.multipart) responses['400'] = errorResponse('Validation failed')
  if (!e.public) {
    responses['401'] = errorResponse('Missing or invalid session')
    responses['403'] = errorResponse('Not allowed for this user')
  }
  if (e.params) responses['404'] = errorResponse('Not found')
  if (e.conflict) responses['409'] = errorResponse(e.conflict)

  const params = parameters(e)
  return {
    operationId: name,
    summary: e.summary,
    tags: [e.tag],
    ...(e.public ? { security: [] } : {}),
    ...(params.length ? { parameters: params } : {}),
    ...(e.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: ref(idOf(e.body, `${name}.body`)) } },
          },
        }
      : {}),
    ...(e.multipart
      ? {
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: { file: { type: 'string', format: 'binary' } },
                  required: ['file'],
                },
              },
            },
          },
        }
      : {}),
    responses,
  }
}

/** Builds the OpenAPI 3.1 document. `npm run openapi` writes it to docs/openapi.json. */
export function buildOpenApiDocument(): JsonSchema {
  const { schemas } = z.toJSONSchema(contractRegistry, {
    io: 'input',
    unrepresentable: 'any',
    uri: (id) => `#/components/schemas/${id}`,
  }) as { schemas: Record<string, JsonSchema> }

  const components: Record<string, JsonSchema> = {}
  for (const id of Object.keys(schemas).sort()) {
    const { $schema: _s, $id: _i, ...rest } = schemas[id] as JsonSchema
    const description = contractDescriptions.get(id)
    components[id] = description && !rest.description ? { description, ...rest } : rest
  }

  const paths: Record<string, JsonSchema> = {}
  for (const [name, e] of Object.entries(api) as [string, EndpointSpec][]) {
    const item = (paths[e.path] ??= {})
    item[e.method.toLowerCase()] = operation(name, e)
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'AX Request Portal API',
      version: '0.1.0',
      description:
        'Contract the AX Request Portal frontend expects. Generated from src/api/contract.ts — do not edit by hand.\n\n' +
        'Every request carries `Accept-Language` (`ko` or `en`, the language the user picked). ' +
        'Error messages, notification texts and AI-written text should come back in that language.',
      license: { name: 'MIT', identifier: 'MIT' },
    },
    servers: [{ url: '/api', description: 'Same-origin (mock or reverse proxy)' }],
    security: [{ bearerAuth: [] }],
    tags: [...new Set(Object.values(api).map((e) => e.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      schemas: components,
    },
  }
}

export function serializeOpenApi(): string {
  return `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`
}
