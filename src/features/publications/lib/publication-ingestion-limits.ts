export const PUBLICATION_INGESTION_BATCH_MAX_ITEMS = 100;

/**
 * Maximum accepted `POST /api/ingestion/publications/batches` body size.
 *
 * The item cap alone does not bound memory: a 100-item batch may legally carry
 * 100 × 5 MB of `bodyText`, so `request.json()` can exhaust the Workers isolate
 * (`exceededMemory`) before validation runs. This byte budget is the memory
 * bound; it is enforced while the body streams in, and an oversized batch is
 * refused whole with 413 rather than truncated.
 *
 * The crawler builds batches against its own hard `DEFAULT_MAX_BATCH_BYTES`
 * ceiling of 2 MiB (it refuses to be configured any higher), so this leaves
 * four times the headroom over the largest batch the producer can emit.
 */
export const PUBLICATION_INGESTION_BATCH_MAX_BODY_BYTES = 8 * 1024 * 1024;
