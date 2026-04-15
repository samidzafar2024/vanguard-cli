# Telemetry Schema Contract

This directory contains the shared schema contract between `vanguard-cli` and `vanguard-web` for telemetry data exchange.

## Schema File

**`telemetry-schema.json`** - JSON Schema v7 specification defining:
- `TelemetryEvent` - Individual event structure
- `TelemetryBatch` - Batch upload format
- `TelemetryEmbedding` - Pre-computed embedding format
- `IngestResponse` - API response format
- `IngestError` - Error format

## Versioning

The schema version is defined in the `version` field. When making breaking changes:

1. Increment the version number
2. Update the `$id` field to include the new version
3. Ensure both CLI and web support the version before deploying

## Keeping Types in Sync

### TypeScript Types

The TypeScript types in `telemetry.types.ts` are derived from this schema. When updating the schema:

1. Update `telemetry-schema.json`
2. Regenerate TypeScript types: `npm run schema:generate` (TODO: add script)
3. Or manually update `telemetry.types.ts` to match

### Database Schema

The database schema in vanguard-web must match the event structure:

**Tables:**
- `events` - Stores TelemetryEvent data
- `ingestion_batches` - Tracks batch uploads
- `telemetry_embeddings` - Stores embeddings

**Required Columns:**
- All non-null fields in TelemetryEvent must have corresponding columns
- Tenant columns: `user_id`, `org_id` (added via migration 20240124000001)

## Validation

### CLI Validation

Before sending batches, the CLI should validate events against the schema to catch issues early.

```typescript
import schema from './telemetry-schema.json';
import Ajv from 'ajv';

const ajv = new Ajv();
const validateBatch = ajv.compile(schema.definitions.TelemetryBatch);

if (!validateBatch(batch)) {
  console.error('Invalid batch:', validateBatch.errors);
}
```

### API Validation

The vanguard-web API validates incoming batches and returns validation errors in the `IngestError` format.

## Breaking Changes

Breaking changes require coordinated deployment:

1. **Backward-compatible addition**: Deploy web first, then CLI
2. **Breaking change**: Deploy both simultaneously or use API versioning

## Schema Sources of Truth

1. **This Schema** (`telemetry-schema.json`) - Single source of truth for API contract
2. **Database Migrations** (`vanguard-web/db/migrations`) - Source of truth for storage schema
3. **TypeScript Types** - Generated from schema, not hand-written

## Testing Contract Compliance

Run schema validation tests before releases:

```bash
# In vanguard-cli
npm run test:schema

# In vanguard-web
npm run test:schema
```

## Common Issues

### Schema Mismatch Errors

**Error**: `column "user_id" does not exist`
**Cause**: Database missing tenant columns from migration 20240124000001
**Fix**: Run `npx tsx scripts/add-missing-tenant-columns.ts` in vanguard-web

**Error**: `INVALID_EVENT` from API
**Cause**: CLI sending fields not in schema or missing required fields
**Fix**: Validate batch locally, check schema version compatibility

### Type Drift

If TypeScript types don't match the schema:
1. Check if schema was updated without regenerating types
2. Regenerate types from schema
3. Update manual type definitions to match schema

## Migration Checklist

When adding new event fields:

- [ ] Update `telemetry-schema.json` in both repos
- [ ] Add database column (if storing persistently)
- [ ] Create database migration in vanguard-web
- [ ] Update TypeScript types
- [ ] Update API ingestion logic
- [ ] Update CLI collection logic
- [ ] Add tests for new field
- [ ] Document the field purpose
