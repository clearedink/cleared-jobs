# Cleared SDK

Cleared is a hackathon-scoped project providing a durable, funded async job lifecycle specifically for batch enrichment workloads. It ensures that every funded job is tracked, duplicate-safe, and has a retrievable outcome, bridging the gap between payments and async task execution.

## Structure

- `packages/core`: Core lifecycle logic and ports.
- `packages/payment-x402`: X402 payment adapter.
- `packages/http-402-express`: Express middleware for 402/Seller API.
- `packages/storage-memory`: In-memory storage for development.
- `packages/storage-postgres`: Postgres storage adapter.
- `packages/worker-adapter`: Worker integration helpers.
- `examples/basic-seller-api`: A demonstration of the public API.
