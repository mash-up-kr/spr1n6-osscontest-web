[한국어](api-design.md) | [English](api-design_EN.md)

# API specification

| Item | Value |
|-----------|------------------------------------------|
| Baseline migration | `V20260823_002__add_worker_indexing_fields.sql` |
| Last modified | 2026-08-26 |

---

## 1. Premises

- There are three version counters: `latest_upload_version_no` (upload succeeded),
  `latest_embedding_version_no` (embedding succeeded), and `searchable_version_id` (search target).
- Indexing is asynchronous. The upload response does not wait for indexing.
- A Job has five states: `PENDING` / `PROCESSING` / `RETRY_WAIT` / `COMPLETED` / `FAILED`.
- A delete request is recorded in `deleted_at`. The physical cleanup afterwards (deleting chunks and the original file) is done by the Worker after it receives the `DOCUMENT_DELETED` event, and is recorded in `purged_at`. There is no grace period.
- The demo seeds demo users and selects one in the UI. Token issuance is out of scope.

---

## 2. Decisions

- **Uploads go through the server as `multipart/form-data`.**
- **Files are up to 20MB, and only PDF, DOCX, Markdown, HWP, and TXT are accepted.** Exceeding the size returns `413`, and any other format returns `415`.
- **The allowed format is decided by the extension.** HWP has no standard MIME type, so the value clients send is inconsistent. `mime_type` stores the value decided from the extension.
- **The API server INSERTs the reindexing Outbox row directly.** It publishes with a new `source_event_id` and puts the original event in `retry_of_event_id`.
- **Reindexing is allowed only for versions whose embedding failed.** Otherwise it returns `409`.
- **Uploading the same file again still creates a version.** The response reports it in `duplicateOfVersionNo`.
- **A document in another tenant returns `404`.** Its existence is not revealed.
- **The client polls the indexing progress.** It calls the progress endpoint periodically.
- **The search target version is updated to the latest each time embedding finishes.** A manual selection stays valid until the next embedding completes.
- **Search results return the context before and after the matched chunk as `contextBefore`/`contextAfter`.**

---

## 3. Common conventions

- The authentication context comes from the `X-User-Id` header. The server looks up `app_user` with this value to get the tenant. The client does not send the tenant.
- The tenant is not exposed in the path; it comes from the authentication context.
- A version is specified by `versionNo`. `document_version.id` is not exposed.
- All times are UTC ISO 8601 (`2026-08-15T04:12:09Z`).

### Paging

```http
GET /api/v1/documents?limit=20&cursor=eyJpZCI6NDJ9
```

```json
{
  "items": [],
  "nextCursor": "eyJpZCI6MjJ9"
}
```

If `nextCursor` is `null`, it is the last page.

### Errors

```json
{
  "code": "DOCUMENT_NOT_FOUND",
  "message": "문서를 찾을 수 없습니다.",
  "traceId": "0af7651916cd43dd"
}
```

| Status | Used when |
|-------|-------------------------------------|
| `202` | Asynchronous processing was started, as with upload and reindexing |
| `400` | Request format or validation failed |
| `401` | `X-User-Id` is missing or the user does not exist |
| `403` | No permission within the same tenant |
| `404` | A missing document, a soft-deleted document, or a document of another tenant |
| `409` | State conflict, such as requesting reindexing for a version whose embedding did not fail |
| `413` | File size exceeded |
| `415` | Unsupported format |
| `500` | Internal server error |
| `502` | External integration failure, such as embedding |
| `503` | Temporarily unable to process because of a DB failover. Retry after `Retry-After` (seconds) |

The response `code` is one of the following. Clients branch on this value, not on the status code.

| `code` | Status | Meaning |
|------------------------------------|-------|-----------------------------------|
| `INVALID_REQUEST` | `400` | The request format is invalid |
| `EMPTY_FILE` | `400` | An empty file was uploaded |
| `INVALID_QUERY` | `400` | The search query is empty |
| `PRINCIPAL_NOT_FOUND` | `400` | The target to grant permission to does not exist |
| `OWNER_PERMISSION_NOT_REVOCABLE` | `400` | The owner's permission cannot be revoked |
| `UNAUTHENTICATED` | `401` | The authentication information is invalid |
| `FORBIDDEN` | `403` | No permission on the document |
| `DOCUMENT_NOT_FOUND` | `404` | The document was not found |
| `DOCUMENT_VERSION_NOT_FOUND` | `404` | The document version was not found |
| `PERMISSION_NOT_FOUND` | `404` | The permission granted on the document was not found |
| `SEARCHABLE_VERSION_NOT_READY` | `409` | Only a version whose indexing finished can be set as the search target |
| `INDEXING_RETRY_NOT_ALLOWED` | `409` | Only a failed job can be retried |
| `INDEXING_RETRY_ALREADY_REQUESTED` | `409` | A reindexing request is already pending |
| `UNSUPPORTED_FILE_TYPE` | `415` | Unsupported file format |
| `INTERNAL_ERROR` | `500` | Server error |
| `UPSTREAM_ERROR` | `502` | Error while processing the query |
| `DB_UNAVAILABLE` | `503` | Temporarily unable to process. A write request may have been applied |

---

## 4. Endpoint list

| Method | Path |
|----------|----------------------------------------------------------------------------|
| `POST` | `/api/v1/documents` |
| `GET` | `/api/v1/documents` |
| `GET` | `/api/v1/documents/{documentId}` |
| `PATCH` | `/api/v1/documents/{documentId}` |
| `DELETE` | `/api/v1/documents/{documentId}` |
| `POST` | `/api/v1/documents/{documentId}/versions` |
| `GET` | `/api/v1/documents/{documentId}/versions` |
| `GET` | `/api/v1/documents/{documentId}/versions/{versionNo}` |
| `GET` | `/api/v1/documents/{documentId}/versions/{versionNo}/content` |
| `PUT` | `/api/v1/documents/{documentId}/searchable-version` |
| `GET` | `/api/v1/documents/{documentId}/versions/{versionNo}/indexing` |
| `POST` | `/api/v1/documents/{documentId}/versions/{versionNo}/indexing/retry` |
| `POST` | `/api/v1/search` |
| `GET` | `/api/v1/documents/{documentId}/permissions` |
| `PUT` | `/api/v1/documents/{documentId}/permissions` |
| `DELETE` | `/api/v1/documents/{documentId}/permissions/{principalType}/{principalId}` |

The MCP tools are in section 10.

---

## 5. Documents

### Create a document and upload version 1

```http
POST /api/v1/documents
Content-Type: multipart/form-data
```

| Part | Type | Required | Description |
|---------|--------|----|--------------------|
| `file` | file | Y | The original file |
| `title` | string | N | If absent, the file name without its extension |

`file` must be 20MB or less and have one of the following extensions. The stored `mimeType` is decided by the extension.

| Extension | `mimeType` |
|--------------------|---------------------------------------------------------------------------|
| `.pdf` | `application/pdf` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.md`, `.markdown` | `text/markdown` |
| `.hwp` | `application/x-hwp` |
| `.txt` | `text/plain` |

```json
202 Accepted

{
  "documentId": 42,
  "versionNo": 1,
  "duplicateOfVersionNo": null,
  "indexing": {
    "status": "PENDING"
  }
}
```

`400` `413` `415`

### Document list

```http
GET /api/v1/documents
```

| Parameter | Type | Default | Description |
|------------------|---------|----|-------------------|
| `limit` | integer | 20 | Maximum 100 |
| `cursor` | string | | Cursor for the next page |
| `q` | string | | Partial match on the title |
| `indexingStatus` | enum | | Filter by the latest version's indexing status |
| `searchable` | boolean | | Filter by whether the document is searchable |

```json
200 OK

{
  "items": [
    {
      "id": 42,
      "title": "2026 사업계획서",
      "latestUploadVersionNo": 3,
      "latestEmbeddingVersionNo": 2,
      "searchableVersionNo": 2,
      "latestVersionIndexingStatus": "PROCESSING",
      "createdAt": "2026-07-02T01:30:00Z",
      "effectivePermission": "WRITE",
      "ownerPrincipalId": "7"
    }
  ],
  "nextCursor": "eyJpZCI6MjJ9"
}
```

### Document details

```http
GET /api/v1/documents/{documentId}
```

```json
200 OK

{
  "id": 42,
  "title": "2026 사업계획서",
  "latestUploadVersionNo": 3,
  "latestEmbeddingVersionNo": 2,
  "searchableVersionNo": 2,
  "latestVersionIndexingStatus": "PROCESSING",
  "createdAt": "2026-07-02T01:30:00Z",
  "effectivePermission": "WRITE",
  "ownerPrincipalId": "7"
}
```

If `searchableVersionNo` is `null`, the document is not searchable yet.

`effectivePermission` is the requester's effective permission (`READ`, `WRITE`, `ADMIN`). The owner has `ADMIN`; for anyone else it is the highest of the permissions granted to the requester and to the requester's tenant. `ownerPrincipalId` is the owner's user id. Each item in the document list has the same fields. The responses of the MCP tools (`list_documents`, `get_document`) do not have these two fields.

`404`

### Delete a document

```http
DELETE /api/v1/documents/{documentId}
```

```
204 No Content
```

Only `deleted_at` is recorded. At this point the `DOCUMENT_DELETED` event is published, and the Worker deletes the original file and chunks, then records `purged_at`.

`404`

### Rename

```http
PATCH /api/v1/documents/{documentId}
Content-Type: application/json

{ "title": "2026 사업계획서 (최종)" }
```

```json
200 OK

{
  "id": 42,
  "title": "2026 사업계획서 (최종)"
}
```

It does not reindex.

`400` `404`

---

## 6. Versions

### Upload a new version

```http
POST /api/v1/documents/{documentId}/versions
Content-Type: multipart/form-data
```

| Part | Type | Required | Description |
|--------|------|----|-------|
| `file` | file | Y | The original file |

```json
202 Accepted

{
  "documentId": 42,
  "versionNo": 3,
  "duplicateOfVersionNo": 1,
  "indexing": {
    "status": "PENDING"
  }
}
```

`duplicateOfVersionNo` is filled when an earlier version has the same `content_hash`. It is compared against all versions, not only the previous one.

`400` `404` `413` `415`

### Version list

```http
GET /api/v1/documents/{documentId}/versions
```

```json
200 OK

{
  "items": [
    {
      "versionNo": 3,
      "originalFilename": "사업계획서_v3.pdf",
      "mimeType": "application/pdf",
      "fileSize": 2481920,
      "uploadedAt": "2026-08-15T04:12:09Z",
      "duplicateOfVersionNo": null,
      "indexing": {
        "status": "RETRY_WAIT",
        "phase": "EMBEDDING",
        "attemptCount": 2,
        "chunkCount": null,
        "startedAt": "2026-08-15T04:12:11Z",
        "completedAt": null,
        "lastErrorMessage": "임베딩 응답이 없습니다",
        "nextRetryAt": "2026-08-15T04:17:11Z",
        "lastErrorCode": "EMBEDDING_TIMEOUT"
      },
      "searchable": false
    },
    {
      "versionNo": 2,
      "originalFilename": "사업계획서_v2.pdf",
      "mimeType": "application/pdf",
      "fileSize": 2390144,
      "uploadedAt": "2026-08-10T02:00:00Z",
      "duplicateOfVersionNo": 1,
      "indexing": {
        "status": "COMPLETED",
        "phase": null,
        "attemptCount": 1,
        "chunkCount": 178,
        "startedAt": "2026-08-10T02:00:03Z",
        "completedAt": "2026-08-10T02:01:10Z",
        "lastErrorMessage": null,
        "nextRetryAt": null,
        "lastErrorCode": null
      },
      "searchable": true
    }
  ],
  "nextCursor": null
}
```

The `indexing` of each item has the same fields and rules as the progress query (excluding `versionNo`). `duplicateOfVersionNo` is the earliest version number in the same document with the same content, and is `null` if that version itself is the earliest. It means the same as the field in the upload response.

`404`

### Version details

```http
GET /api/v1/documents/{documentId}/versions/{versionNo}
```

It is an item of the version list plus `sourceMetadata` and `extractedMetadata`.

`404`

### Download the original

```http
GET /api/v1/documents/{documentId}/versions/{versionNo}/content
```

```
200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename*=UTF-8''%EC%82%AC%EC%97%85%EA%B3%84%ED%9A%8D%EC%84%9C_v3.pdf
```

`404`

### Change the search target version

```http
PUT /api/v1/documents/{documentId}/searchable-version
Content-Type: application/json

{ "versionNo": 2 }
```

```json
200 OK

{
  "searchableVersionNo": 2
}
```

Only a version whose embedding has completed can be specified. When the next embedding completes, it moves back to the latest version.

`400` `404` `409`

---

## 7. Indexing

### Progress query

```http
GET /api/v1/documents/{documentId}/versions/{versionNo}/indexing
```

```json
200 OK

{
  "versionNo": 3,
  "status": "PROCESSING",
  "phase": "EMBEDDING",
  "attemptCount": 1,
  "chunkCount": null,
  "startedAt": "2026-08-15T04:12:11Z",
  "completedAt": null,
  "lastErrorMessage": null,
  "nextRetryAt": null,
  "lastErrorCode": null
}
```

It is the `indexing_job` row for the latest `outbox_event` of that version. If the worker has not consumed that event yet, `status` is `PENDING`. `phase` is the current processing phase the worker recorded, and is `null` before the job is created or when no phase was recorded. `nextRetryAt` is the time the worker will try again when the status is `RETRY_WAIT`, and `null` in every other state. `lastErrorCode` is the error code the worker left on the last failure. It is filled together with `lastErrorMessage`, and both values from the previous failure remain even while the next attempt is running or after it completes. `COMPLETED` and `FAILED` are the terminal states, and the client stops polling there.

`404`

### Request reindexing

```http
POST /api/v1/documents/{documentId}/versions/{versionNo}/indexing/retry
```

```json
202 Accepted

{
  "versionNo": 3,
  "indexing": {
    "status": "PENDING"
  }
}
```

It is allowed only for a version whose embedding failed. Otherwise it returns `409`. It also returns `409` when a reindexing event that the worker has not yet consumed remains.

`404` `409`

---

## 8. Search

### Run a search

```http
POST /api/v1/search
Content-Type: application/json

{
  "query": "3개월 이내 해지 시 위약금",
  "topK": 10,
  "contextWindow": 1,
  "rerank": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | Y | The search query |
| `topK` | integer | N | Default 10, maximum 50 |
| `contextWindow` | integer | N | Number of chunks to return before and after the matched chunk. Default 0 (none), maximum 5 |
| `rerank` | boolean | N | Whether to refine the results with a reranking model (Cohere Rerank). Default true. Higher accuracy, higher latency. Without `COHERE_API_KEY`, the RRF order is used regardless of the value |

```json
200 OK

{
  "items": [
    {
      "chunkId": 981,
      "documentId": 42,
      "title": "2026 사업계획서",
      "content": "이 경우 위약금은 계약금의 10%를 초과할 수 없다.",
      "contextBefore": [
        "본 계약을 체결일로부터 3개월 이내에 해지하는 경우,"
      ],
      "contextAfter": [
        "다만 천재지변으로 인한 해지는 예외로 한다."
      ],
      "score": 0.0421,
      "pageFrom": 12,
      "pageTo": 12,
      "sectionPath": "제3장 > 해지 조항"
    }
  ]
}
```

`contextBefore`/`contextAfter` are arrays of the original text of the chunks whose `chunk_no` continues before and after the matched chunk. They are sorted in the original order, so they read continuously as `contextBefore` + `content` + `contextAfter`. The length is at most `contextWindow`, and shorter or an empty array when it hits the document boundary.

`score` is the sum of the vector similarity rank and the keyword match rank.

**`contextWindow` takes the depth of the surrounding context as a parameter.**

`400` `401`

---

## 9. Permissions

### Permission list

```http
GET /api/v1/documents/{documentId}/permissions
```

```json
200 OK

{
  "items": [
    {
      "principalType": "USER",
      "principalId": "17",
      "permission": "WRITE"
    },
    {
      "principalType": "TENANT",
      "principalId": "1",
      "permission": "READ"
    }
  ]
}
```

`403` `404`

### Grant or change a permission

```http
PUT /api/v1/documents/{documentId}/permissions
Content-Type: application/json

{ "principalType": "USER", "principalId": "17", "permission": "WRITE" }
```

```json
200 OK

{
  "principalType": "USER",
  "principalId": "17",
  "permission": "WRITE"
}
```

If it already exists, `permission` is changed.

`400` `403` `404`

### Revoke a permission

```http
DELETE /api/v1/documents/{documentId}/permissions/{principalType}/{principalId}
```

```
204 No Content
```

`403` `404`

---

## 10. MCP tools

This is the interface AI clients connect to. The endpoint is `/mcp`, and it communicates over Streamable HTTP.

It goes through the same permission checks as REST. However, the identity comes from the `X-Search-User-Id` header. It is a different header from REST's `X-User-Id`, and a missing or non-numeric value is answered as an authentication failure. The documents the tools return are the same ones that user could see through REST.

All three tools are read-only. They do not create, modify, or delete documents.

### search_documents

Searches documents with a query. It returns the matched chunks together with the surrounding context and the information of the document they belong to.

| Parameter | Type | Required | Description |
|-----------------|--------|:--:|------------------------------------------|
| `query` | string | Y | The search query |
| `topK` | int | N | Maximum number of results to return (default 10, maximum 50) |
| `contextWindow` | int | N | Number of chunks to return before and after the matched chunk (default 0, maximum 5) |
| `efSearch` | int | N | HNSW search breadth (default 100, 1 to 500). The larger, the more accurate and the slower |

The response has the same shape as the result array of `POST /api/v1/search`.

### list_documents

Lists the documents belonging to the tenant. It supports cursor-based pagination.

| Parameter | Type | Required | Description |
|------------------|---------|:--:|-------------------------------------------------------|
| `limit` | int | N | Maximum number of documents to return (default 20, maximum 100) |
| `cursor` | string | N | The `nextCursor` of the previous response |
| `q` | string | N | Title search term |
| `indexingStatus` | string | N | Filter by the latest version's indexing status (`PENDING`/`PROCESSING`/`RETRY_WAIT`/`COMPLETED`/`FAILED`) |
| `searchable` | boolean | N | Whether to keep only documents that have a search target version |

The response has the same shape as `GET /api/v1/documents`.

### get_document

Fetches the document details directly by `documentId`, without searching.

| Parameter | Type | Required | Description |
|--------------|------|:--:|--------|
| `documentId` | long | Y | Document identifier |

The response has the same shape as `GET /api/v1/documents/{documentId}`.
