# API–UI 연동 가이드

이 웹 앱은 `api-design.md`의 API 계약을 사용합니다. 문서·검색 mock 데이터와 인덱싱 mock 타이머는 제거했습니다.

## 실행 설정

API가 웹 앱과 같은 origin에서 제공되면 별도 설정이 필요하지 않습니다. 다른 origin을 사용하면 Vite 환경 변수에 API origin을 지정합니다.

```bash
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

모든 요청에는 Header에서 선택한 데모 사용자의 식별자가 자동으로 들어갑니다.

```http
X-User-Id: tenant-a-user-a
```

테넌트 식별자는 경로나 body로 보내지 않습니다.

## 코드 구조

```text
src/api/client.ts       공통 base URL, X-User-Id, JSON/multipart, 공통 에러
src/api/documents.ts    문서·버전·원본 다운로드 API
src/api/indexing.ts     인덱싱 상태 조회·재시도 API
src/api/search.ts       검색 API
src/api/permissions.ts  권한 API
src/data/demoUsers.ts   서버에 시드된 데모 사용자 선택 목록
```

## 화면별 API

### 문서 목록과 업로드

- `GET /api/v1/documents`: `q`, `indexingStatus`, `searchable`, `limit`, `cursor`를 서버에 전달합니다.
- `POST /api/v1/documents`: `file`과 선택적인 `title`을 multipart로 전송합니다.
- 더 보기는 응답의 `nextCursor`가 있을 때만 표시합니다.
- 업로드 허용 확장자는 PDF, DOCX, Markdown, HWP, TXT이며 클라이언트에서도 20MB 제한을 먼저 확인합니다.

### 문서 상세과 버전

- 상세 진입 시 문서, 버전 목록, 최신 버전 인덱싱 상태, 권한 목록을 조회합니다.
- 제목 변경과 삭제는 각각 `PATCH`, `DELETE /api/v1/documents/{documentId}`를 사용합니다.
- 새 버전은 `POST /api/v1/documents/{documentId}/versions`로 업로드합니다.
- 버전 상세는 Drawer를 열 때 조회합니다.
- 원본은 Blob으로 받고 `Content-Disposition`의 UTF-8 파일명을 사용해 다운로드합니다.
- 검색 대상 변경은 `PUT /api/v1/documents/{documentId}/searchable-version`에 `versionNo`를 전송합니다.

### 인덱싱 상태

인덱싱 상태는 `COMPLETED` 또는 `FAILED`가 될 때까지 다음 엔드포인트를 3초 간격으로 조회합니다.

```http
GET /api/v1/documents/{documentId}/versions/{versionNo}/indexing
```

API에 정의되지 않은 처리 단계나 임의 진행률은 표시하지 않습니다. 재인덱싱은 `FAILED` 버전에만 노출하며 서버의 `409` 응답은 공통 상태 충돌 안내로 처리합니다.

### 검색

검색 화면은 `POST /api/v1/search`에 `query`, `topK`, `contextWindow`, `efSearch`를 보냅니다. 결과에는 API의 다음 값을 그대로 사용합니다.

- `score`
- `pageFrom` / `pageTo`
- `sectionPath`
- `contextBefore` / `content` / `contextAfter`

검색 응답에는 `versionNo`가 없으므로 결과 액션은 버전 행이 아니라 문서 상세로 이동합니다.

### 권한

권한 목록·부여/변경·회수 API를 모두 연결했습니다. API 응답에는 표시 이름이 없으므로 데모 사용자는 `demoUsers.ts`에서 이름을 해석하고, 알 수 없는 대상은 `principalId`를 표시합니다.

## 에러 처리

공통 에러 응답의 `message`와 `traceId`를 파싱합니다. 주요 상태는 다음처럼 표시합니다.

| 상태 | UI 처리 |
|---|---|
| `400` | 서버 검증 메시지 |
| `401` | 데모 사용자 확인 안내 |
| `403` | 작업 권한 없음 안내 |
| `404` | 문서가 없거나 현재 사용자에게 제공되지 않는다는 통합 안내 |
| `409` | 상태 새로고침 안내 |
| `413` | 20MB 제한 안내 |
| `415` | 지원 형식 안내 |

다른 테넌트의 문서 접근도 `404`로만 처리하며 존재 여부를 별도로 드러내지 않습니다.
