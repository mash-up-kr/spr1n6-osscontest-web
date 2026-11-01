[한국어](API_UI_INTEGRATION_GUIDE.md) | [English](API_UI_INTEGRATION_GUIDE_EN.md)

# API–UI integration guide

This web app uses the API contract in `api-design_EN.md`. The mock data for documents and search, and the mock timers for indexing, have been removed.

## Runtime configuration

No extra configuration is needed when the API is served from the same origin as the web app. For a different origin, set the API origin in a Vite environment variable.

```bash
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

Every request automatically carries the identifier of the demo user selected in the header.

```http
X-User-Id: 1
```

The tenant identifier is not sent as a header. The demo users are A, B, C (tenant A, `tenantId` `1`) and D (tenant B, `tenantId` `2`). The `principalId` of a request that adds or revokes a tenant permission is the current user's `tenantId` (`1` for A, B, C and `2` for D). When granting a user permission, you can only choose users in the same tenant as the current user.

## Code structure

```text
src/api/client.ts       Common base URL, X-User-Id, JSON/multipart, common errors
src/api/documents.ts    Document, version, and original download APIs
src/api/indexing.ts     Indexing status query and retry APIs
src/api/search.ts       Search API
src/api/permissions.ts  Permission APIs
src/data/demoUsers.ts   Demo user choices seeded on the server
```

## APIs by screen

### Document list and upload

- `GET /api/v1/documents`: Passes `q`, `indexingStatus`, `searchable`, `limit`, and `cursor` to the server.
- `POST /api/v1/documents`: Sends `file` and an optional `title` as multipart.
- The "load more" button is shown only when the response has a `nextCursor`.
- Allowed upload extensions are PDF, DOCX, Markdown, HWP, and TXT. The client also checks the 20MB limit first.

### Document details and versions

- On entering the details, it fetches the document, the version list, the latest version's indexing status, and the permission list.
- Renaming and deleting use `PATCH` and `DELETE /api/v1/documents/{documentId}` respectively.
- A new version is uploaded with `POST /api/v1/documents/{documentId}/versions`.
- Version details are fetched when the drawer opens.
- The original is received as a Blob and downloaded using the UTF-8 file name in `Content-Disposition`.
- Changing the search target sends `versionNo` to `PUT /api/v1/documents/{documentId}/searchable-version`.

### Indexing status

The indexing status is polled every 3 seconds from the following endpoint until it becomes `COMPLETED` or `FAILED`.

```http
GET /api/v1/documents/{documentId}/versions/{versionNo}/indexing
```

Processing phases or arbitrary progress that the API does not define are not shown. Reindexing is exposed only for `FAILED` versions, and the server's `409` response is handled with the common state conflict notice.

### Search

The search screen sends `query`, `topK`, `contextWindow`, and `rerank` to `POST /api/v1/search`. `rerank` decides whether the top candidates are reordered with Cohere Rerank, and is on by default. Accuracy improves at the cost of latency, and if the server has no `COHERE_API_KEY`, the RRF order is used regardless of the value. The following API values are used in results as they are.

- `score`
- `pageFrom` / `pageTo`
- `sectionPath`
- `contextBefore` / `content` / `contextAfter`

The search response has no `versionNo`, so a result's action goes to the document details, not to a version row.

### Permissions

The permission list, grant/change, and revoke APIs are all connected. The API response has no display name, so demo users are resolved by name in `demoUsers.ts`, and unknown targets show their `principalId`.

## Error handling

The `message` and `traceId` of the common error response are parsed. Main statuses are shown as follows.

| Status | UI handling |
|---|---|
| `400` | Server validation message |
| `401` | Notice to check the demo user |
| `403` | Notice that the user has no permission for the action |
| `404` | A combined notice that the document does not exist or is not available to the current user |
| `409` | Notice to refresh the state |
| `413` | Notice about the 20MB limit |
| `415` | Notice about supported formats |
| `503` | Reads show a temporary unavailability notice; writes show a notice that the request may not have been processed |

### Retrying 503 during a DB failover

The server responds with `503` and `Retry-After` during a DB failover. Requests that do not change data (`GET` and search) are retried at the `Retry-After` interval (5 seconds if absent) for up to 45 seconds, and a notice (`RetryNotice`) is shown on screen while retrying. Write requests are not resent, because they may already have been applied even when a failure response came back. Indexing status polling already queries again every 3 seconds on its own, so it is excluded from retries.

Access to another tenant's document is also handled only as `404`, without revealing whether it exists.
