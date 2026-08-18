# API–UI 연동

이 문서는 API 서버와 웹 UI의 대응 관계, 현재 구현 상태, 실제 API 연동 시 교체해야 할 코드와 주의사항을 설명합니다.

## 1. 가장 먼저 알아야 할 내용

현재 웹 프로젝트는 **API 연동 전 단계의 UI 프로토타입**입니다.

- 실제 HTTP 요청을 전송하지 않습니다.
- 실제 SSE 서버에 연결하지 않습니다.
- 문서, 버전, 권한, 검색 결과는 `src/data/mockData.ts`에서 제공합니다.
- 업로드, 재인덱싱, 권한 변경 등의 동작은 `src/App.tsx`의 React 상태를 변경하는 방식으로 모사합니다.
- API 엔드포인트별 화면과 사용자 흐름은 P0부터 P2까지 준비되어 있습니다.

따라서 이 문서에서 “대응됨”은 **해당 API를 연결할 화면과 상호작용이 구현되어 있다**는 의미이며, 실제 네트워크 연동이 완료되었다는 의미는 아닙니다.

## 2. 현재 화면 구조

```text
Header
└── 데모 사용자 선택

Sidebar
├── 문서
│   ├── 문서 목록
│   │   └── 검색 대상 버전 바로 변경
│   ├── 문서 업로드
│   ├── 빠른 상태 Drawer
│   └── 문서 상세
│       ├── 개요
│       ├── 버전
│       └── 권한
└── 검색
    ├── 자연어 검색
    ├── 검색 결과
    └── 원문 버전 이동
```

주요 파일은 다음과 같습니다.

| 역할 | 파일 |
|---|---|
| 전체 화면 상태와 mock 동작 | `src/App.tsx` |
| 문서 목록, 필터, 검색 대상 버전 바로 변경, 더 보기 | `src/components/DocumentsPage.tsx` |
| 문서 빠른 상태 확인 | `src/components/DocumentDrawer.tsx` |
| 문서 상세와 P1/P2 액션 | `src/components/DocumentDetailPage.tsx` |
| 문서 업로드 | `src/components/UploadPanel.tsx` |
| 버전 상세와 메타데이터 | `src/components/VersionDrawer.tsx` |
| 자연어 검색 | `src/components/SearchPage.tsx` |
| 데모 사용자 선택 | `src/components/Header.tsx` |
| 공통 상태 배지 | `src/components/StatusBadge.tsx` |
| API 대응 타입 | `src/types.ts` |
| 문서·버전·권한·검색 mock | `src/data/mockData.ts` |

## 3. 엔드포인트별 UI 대응표

### 3.1 문서 API

| API | 우선순위 | UI 위치 | 현재 동작 | 실제 연동 시 교체 지점 |
|---|---:|---|---|---|
| `POST /api/v1/documents` | P0 | 문서 화면 → `문서 업로드` | 파일과 선택 제목으로 새 mock 문서를 추가 | `UploadPanel` 제출 결과를 `App.handleUpload` 대신 multipart 요청으로 연결 |
| `GET /api/v1/documents` | P0 | 문서 목록 | 사용자 권한에 맞는 mock 문서를 필터링 | 문서 화면 진입·필터 변경·더 보기 시 목록 API 호출 |
| `GET /api/v1/documents/{documentId}` | P0 | 빠른 Drawer, 문서 상세 `개요` | 선택한 mock 문서 표시 | 상세 진입 시 문서 상세 API 호출 |
| `DELETE /api/v1/documents/{documentId}` | P1 | 문서 상세 → `삭제` | 확인 Modal 후 React 상태에서 제거 | 성공 시 목록 캐시에서 제거하고 문서 목록으로 이동 |
| `PATCH /api/v1/documents/{documentId}` | P2 | 문서 상세 → `이름 변경` | 제목만 로컬 상태에서 변경 | `{ title }` 요청 후 상세·목록 데이터 갱신 |

#### 문서 목록에 표시되는 정보

```text
문서 제목
최신 업로드 버전
검색 대상 버전
최신 버전의 인덱싱 상태
검색 가능 여부
생성일
```

목록 필터는 API 쿼리와 다음처럼 대응됩니다.

| UI | API 파라미터 |
|---|---|
| 문서 제목 검색 | `q` |
| 인덱싱 상태 | `indexingStatus` |
| 검색 가능 여부 | `searchable` |
| 더 보기 | `limit`, `cursor` |

현재 필터와 더 보기는 배열을 클라이언트에서 처리합니다. 실제 연동 후에는 필터가 변경될 때 첫 페이지를 다시 조회하고, `nextCursor`가 있을 때만 `더 보기`를 노출해야 합니다.

### 3.2 버전 API

| API | 우선순위 | UI 위치 | 현재 동작 | 실제 연동 시 교체 지점 |
|---|---:|---|---|---|
| `POST /api/v1/documents/{documentId}/versions` | P1 | 문서 상세 → 버전 → `새 버전 업로드` | 최신 번호에 1을 더한 mock 버전 생성 | multipart 요청 후 응답의 `versionNo`로 버전 행 추가 |
| `GET /api/v1/documents/{documentId}/versions` | P1 | 문서 상세 → `버전` 탭 | mock 버전 목록과 `버전 더 보기` 제공 | cursor 기반 버전 목록 조회로 교체 |
| `GET /api/v1/documents/{documentId}/versions/{versionNo}` | P2 | 버전 행 → `상세` Drawer | 파일 정보와 source/extracted metadata 표시 | Drawer를 열 때 버전 상세 조회 |
| `GET /api/v1/documents/{documentId}/versions/{versionNo}/content` | P1 | 버전 행 또는 Drawer → `다운로드` | 완료 Toast만 표시 | Blob 다운로드 및 `Content-Disposition` 파일명 처리 |
| `PUT /api/v1/documents/{documentId}/searchable-version` | P2 | 문서 목록 → `vN 사용 중` 라디오 메뉴 또는 문서 상세 → 버전 → `검색에 사용` | 목록에서는 선택 즉시 변경하고, 상세에서는 확인 Modal 후 변경 | `{ versionNo }` 요청 후 문서 목록·상세·버전 목록 캐시 갱신 |

#### 문서 목록에서 검색 대상 버전 변경

문서 목록의 `검색 대상` 열에서 현재 사용 중인 버전을 누르면 인덱싱이 완료된 버전 목록이 라디오 메뉴로 열립니다.

```text
v2 사용 중 ▾
┌─────────────────────────────────────┐
│ 검색 대상 버전                     │
│ 인덱싱이 완료된 버전만 선택 가능   │
├─────────────────────────────────────┤
│ ● v2  OpenSQL_가이드_v2.pdf  사용 중│
│ ○ v1  OpenSQL_가이드.pdf       선택 │
├─────────────────────────────────────┤
│ 전체 버전 관리                    › │
└─────────────────────────────────────┘
```

- `COMPLETED` 상태의 버전만 선택 목록에 표시합니다.
- 현재 검색 대상은 선택된 라디오와 `사용 중` 문구로 구분합니다.
- 버전을 선택하면 mock 상태에서는 즉시 `searchableVersionNo`와 각 버전의 `searchable` 값을 갱신합니다.
- 읽기 권한만 있는 사용자는 변경할 수 없으며 버튼이 비활성화됩니다.
- 완료된 버전이 없는 문서도 버튼을 비활성화하고 `검색 불가`로 표시합니다.
- 실제 API 연결 후에는 선택 시 `PUT /api/v1/documents/{documentId}/searchable-version`에 `{ "versionNo": N }`을 보냅니다.
- 요청 중에는 중복 선택을 막고, `409` 응답이면 기존 선택을 유지한 채 상태 충돌 메시지를 표시해야 합니다.

#### 버전 화면에 표시되는 정보

```text
버전 번호
원본 파일명
MIME 형식
파일 크기
업로드 시각
인덱싱 상태
처리 단계
시도 횟수
청크 수
검색 대상 여부
원본/추출 메타데이터
```

`duplicateOfVersionNo`가 존재하면 버전 번호 아래에 다음과 같이 표시합니다.

```text
v3
v1과 동일
```

API 초안에서는 `duplicateOfVersionNo`가 업로드 응답에만 포함됩니다. 페이지를 새로 열어도 중복 정보를 계속 표시하려면 버전 목록 또는 버전 상세 응답에도 해당 필드가 필요합니다.

### 3.3 인덱싱 API

| API | 우선순위 | UI 위치 | 현재 동작 | 실제 연동 시 교체 지점 |
|---|---:|---|---|---|
| `GET /api/v1/documents/{documentId}/versions/{versionNo}/indexing` | P0 | 문서 상세 → 개요 → `인덱싱 상태` | mock Job 정보를 표시 | 상세 진입 및 SSE 재연결 실패 시 단건 상태 조회 |
| `GET /api/v1/documents/{documentId}/versions/{versionNo}/indexing/events` | P0 | 문서 목록 상태, Quick Drawer, 개요 | 타이머로 단계와 진행률을 변경 | 버전별 SSE 구독으로 교체 |
| `POST /api/v1/documents/{documentId}/versions/{versionNo}/indexing/retry` | P1 | 실패한 버전 → `재인덱싱` 또는 `재시도` | 상태를 대기로 되돌리고 mock 처리 재시작 | `202` 응답 후 해당 버전 SSE 재구독 |

현재 UI는 다음 정보를 표시합니다.

```text
Job 상태
처리 단계
진행률
시도 횟수
청크 수
시작 시각
완료 시각
마지막 오류 메시지
다음 재시도 시각
```

### API 계약과 UI 단계의 차이

API의 Job 상태는 다음 다섯 개입니다.

```text
PENDING / PROCESSING / RETRY_WAIT / COMPLETED / FAILED
```

UI의 처리 단계는 다음과 같습니다.

```text
UPLOADED / PARSING / CHUNKING / EMBEDDING / INDEXED
```

현재 API 응답 예시에는 `PROCESSING` 내부 단계를 구분하는 필드와 진행률이 없습니다. 단계형 UI를 실제 값으로 갱신하려면 단건 응답과 SSE 이벤트에 다음과 같은 필드가 추가되어야 합니다.

```json
{
  "status": "PROCESSING",
  "stage": "EMBEDDING",
  "progressPercent": 72,
  "attemptCount": 1
}
```

해당 필드가 추가되지 않으면 실제 연동 시 UI를 단계형 Stepper가 아닌 `처리 중` 단일 상태와 비결정형 Progress로 축소해야 합니다.

`RETRY_WAIT`의 다음 재시도 시각을 표시하려면 `nextRetryAt`도 필요합니다.

### SSE 연결 생명주기

실제 연동 시 다음 규칙을 지켜야 합니다.

1. 업로드 `202` 응답에서 `documentId`, `versionNo`를 받습니다.
2. 해당 버전의 SSE 엔드포인트에 연결합니다.
3. 이벤트를 받을 때 문서 목록, Quick Drawer, 상세 화면의 동일 버전을 함께 갱신합니다.
4. `COMPLETED` 또는 `FAILED`를 받으면 연결을 종료합니다.
5. 데모 사용자가 바뀌거나 화면이 제거되면 기존 연결을 즉시 종료합니다.
6. SSE 연결이 끊기면 단건 상태 API로 최종 상태를 확인한 뒤 제한적으로 재연결합니다.

> 중요: 브라우저의 기본 `EventSource`는 임의의 `X-User-Id` 헤더를 추가할 수 없습니다. 모든 API가 `X-User-Id`를 요구한다면 fetch 기반 SSE 클라이언트를 사용하거나, SSE 인증 방식만 쿠키 또는 다른 서버 지원 방식으로 조정해야 합니다.

### 3.4 검색 API

| API | 우선순위 | UI 위치 | 현재 동작 | 실제 연동 시 교체 지점 |
|---|---:|---|---|---|
| `POST /api/v1/search` | P0 | Sidebar → 검색 | 사용자·테넌트별 mock 결과 제공 | `SearchPage.search`의 타이머와 mock 필터를 실제 요청으로 교체 |

검색 화면은 다음 상태를 지원합니다.

```text
초기 상태
검색 중
결과 있음
결과 없음
접근 권한 없음
검색 실패
```

검색 결과에는 다음 정보를 표시하도록 준비되어 있습니다.

```text
documentId
documentTitle
versionNo
similarity
page
chunkNo
section
content
elapsedMs
```

검색 결과의 `원문 위치 보기`를 누르면 해당 문서의 `버전` 탭으로 이동하고 검색에 사용된 버전을 강조합니다.

데모 사용자가 변경되면 테넌트가 같은지와 관계없이 진행 중인 검색을 무효화하고 기존 결과를 완전히 제거한 뒤 초기 상태로 돌아갑니다. 이때 `접근 권한 없음`으로 해석하지 않고 사용자 컨텍스트가 변경되어 결과를 초기화했다는 중립 안내를 표시합니다. `접근 권한 없음` 화면은 데모 응답의 `권한 없음 (403)`을 선택하거나, 실제 연동 후 같은 테넌트 문서의 직접 접근에서 `403`이 반환된 경우에 사용합니다.

검색 API의 요청·응답 계약은 아직 확정되지 않았으므로 위 필드명과 페이징·필터 방식은 검색 API 확정 후 조정해야 합니다.

### 3.5 권한 API

| API | 우선순위 | UI 위치 | 현재 동작 | 실제 연동 시 교체 지점 |
|---|---:|---|---|---|
| `GET /api/v1/documents/{documentId}/permissions` | P2 | 문서 상세 → `권한` 탭 | mock 권한 목록 표시 | 권한 탭 진입 시 조회 |
| `PUT /api/v1/documents/{documentId}/permissions` | P2 | `권한 부여`, `읽기/쓰기로 변경` | mock 권한 추가 또는 갱신 | 저장 요청 후 권한 목록 재조회 |
| `DELETE /api/v1/documents/{documentId}/permissions/{principalType}/{principalId}` | P2 | 권한 행 → `회수` | mock 권한 목록에서 제거 | `204` 응답 후 권한 목록에서 제거 |

권한 화면은 다음 기능을 제공합니다.

- USER 또는 TENANT 대상 선택
- READ 또는 WRITE 권한 선택
- 기존 권한 변경
- 권한 회수
- 현재 사용자의 권한 표시
- READ 사용자의 변경 액션 비활성화

현재 권한 응답은 `principalId`만 제공하므로 사용자 이름을 표시하기 위해 다음 중 하나가 필요합니다.

- 권한 응답에 `principalName` 추가
- 테넌트 사용자 조회 API 추가
- 데모 사용자 시드 정보를 프론트 설정으로 공유

또한 문서 상세 응답에 `currentUserPermission` 또는 `allowedActions`가 있으면 UI 액션 활성 여부를 더 정확히 판단할 수 있습니다.

## 4. 데모 사용자와 인증 컨텍스트

Header의 데모 사용자 선택은 이후 모든 요청의 `X-User-Id`를 결정합니다.

실제 연동 시 공통 HTTP 클라이언트가 다음 헤더를 자동으로 추가하도록 구성하는 것을 권장합니다.

```http
X-User-Id: tenant-a-user-a
```

클라이언트는 테넌트를 요청 경로나 body에 포함하지 않습니다. 테넌트는 서버가 `X-User-Id`로 조회합니다.

사용자를 변경할 때 UI에서 해야 할 작업은 다음과 같습니다.

```text
진행 중인 검색 취소
기존 문서·권한 요청 취소
열려 있는 Drawer와 상세 화면 닫기
기존 검색 결과 제거
기존 SSE 연결 종료
새 X-User-Id로 문서 목록 조회
```

## 5. 버전 카운터 표시 규칙

문서 상세 `개요`에는 API의 세 버전 카운터를 각각 표시합니다.

| API 필드 | UI 문구 | 의미 |
|---|---|---|
| `latestUploadVersionNo` | 최신 업로드 | 원본 업로드가 성공한 가장 최근 버전 |
| `latestEmbeddingVersionNo` | 최신 임베딩 | 임베딩이 성공한 가장 최근 버전 |
| `searchableVersionNo` | 검색 대상 | 현재 검색에 실제로 사용되는 버전 |

서로 다른 경우 다음 안내를 노출합니다.

```text
버전 3을 인덱싱하고 있습니다.
현재 검색에는 버전 2를 사용합니다.
```

수동으로 검색 대상 버전을 변경한 이후 더 최신 버전의 임베딩이 완료되면 API 정책에 따라 검색 대상은 최신 버전으로 자동 이동해야 합니다. 현재 mock 동작도 이 규칙을 따릅니다.

`latestEmbeddingVersionNo`는 임베딩에 성공한 가장 높은 버전 번호이며 감소하지 않습니다. 과거 버전의 재인덱싱이 나중에 완료되거나 동일한 완료 이벤트가 중복으로 전달되더라도 `latestEmbeddingVersionNo`, `searchableVersionNo`, 각 버전의 `searchable` 플래그는 변경하지 않습니다. 처리 대상 버전 자체의 상태·시도 횟수·완료 시각만 갱신합니다.

## 6. 에러 상태 대응

| HTTP 상태 | UI 처리 |
|---|---|
| `400` | 해당 Form 내부에 검증 메시지 표시 |
| `401` | 현재 데모 사용자가 유효하지 않다는 안내 후 사용자 재선택 유도 |
| `403` | 현재 화면 안에 `접근 권한이 없습니다` 표시 |
| `404` | `문서가 없거나 현재 사용자에게 제공되지 않습니다`로 통합 표시 |
| `409` | 현재 상태에서는 작업할 수 없다는 안내와 상태 새로고침 제공 |
| `413` | 파일이 20MB 제한을 초과했다는 업로드 오류 표시 |
| `415` | 지원하지 않는 파일 형식 오류 표시 |

다른 테넌트의 문서는 존재 자체를 노출하지 않아야 하므로 `404`를 `권한 없음`으로 바꾸어 표시하면 안 됩니다.

검색 실패 UI에는 지원 문의에 사용할 수 있도록 `traceId` 표시 영역이 준비되어 있습니다. 실제 오류 응답의 `traceId`로 교체해야 합니다.

## 7. 시각 처리 규칙

- API 시각은 UTC ISO 8601 문자열로 받습니다.
- UI에서는 브라우저 로컬 시간으로 변환합니다.
- 필요하면 원본 UTC 시각을 `title` 또는 상세 정보로 함께 제공할 수 있습니다.
- 버전 번호는 외부 식별자인 `versionNo`만 표시합니다.
- `document_version.id`, `tenantId`, DB PK 등의 내부 식별자는 화면에 표시하지 않습니다.

## 8. 실제 연동 시 권장 파일 구조

현재는 UI 구조 확인을 위해 상태가 `App.tsx`에 모여 있습니다. 실제 연동을 시작할 때는 다음 정도로 분리하는 것을 권장합니다.

```text
src/
├── api/
│   ├── client.ts
│   ├── documents.ts
│   ├── indexing.ts
│   ├── search.ts
│   └── permissions.ts
├── hooks/
│   ├── useDocuments.ts
│   ├── useDocument.ts
│   ├── useIndexingEvents.ts
│   └── useSearch.ts
├── components/
├── types/
└── App.tsx
```

### 공통 API 클라이언트가 담당할 항목

- API base URL
- `X-User-Id` 헤더 주입
- JSON 및 multipart 요청
- 공통 에러 응답 파싱
- `traceId` 전달
- 요청 취소용 `AbortController`

## 9. mock 교체 순서

실제 API를 연결할 때 다음 순서로 진행하면 화면 전체를 한 번에 교체하는 위험을 줄일 수 있습니다.

1. 공통 API 클라이언트와 `X-User-Id` 주입을 구현합니다.
2. 문서 목록과 목록 필터·cursor를 연결합니다.
3. 문서 업로드와 업로드 오류를 연결합니다.
4. 문서 상세과 인덱싱 단건 조회를 연결합니다.
5. SSE 구독과 재연결 처리를 연결합니다.
6. 버전 목록, 업로드, 상세, 다운로드를 연결합니다.
7. 재인덱싱과 검색 대상 버전 변경을 연결합니다.
8. 검색 API를 연결합니다.
9. 권한 조회·변경·회수를 연결합니다.
10. `src/data/mockData.ts` 의존성을 제거합니다.

## 10. 권장 검증 시나리오

### 기본 문서 처리

```text
사용자 A 선택
→ PDF 업로드
→ 202 응답 확인
→ 문서 목록에 PENDING 표시
→ SSE로 PROCESSING 수신
→ COMPLETED와 chunkCount 수신
→ searchableVersionNo 갱신 확인
→ 검색 화면에서 검색 성공 확인
```

### 버전 관리

```text
문서 상세 진입
→ 새 버전 업로드
→ latestUploadVersionNo 증가 확인
→ 기존 searchableVersionNo 유지 확인
→ 새 버전 임베딩 완료
→ searchableVersionNo가 최신 버전으로 이동하는지 확인
```

### 권한 격리

```text
사용자 A로 문서와 검색 결과 확인
→ 같은 테넌트의 읽기 권한 사용자로 변경
→ 수정 액션 비활성화 확인
→ 다른 테넌트 사용자로 변경
→ 기존 결과 제거 확인
→ 다른 테넌트 문서 직접 접근 시 404 처리 확인
```

### 실패와 재시도

```text
FAILED 버전 확인
→ 마지막 오류와 attemptCount 확인
→ 재인덱싱 요청
→ 202와 PENDING 확인
→ SSE 재구독
→ 완료 또는 재실패 상태 확인
```

## 11. 아직 서버 계약 확정이 필요한 항목

다음 항목은 UI에 mock 형태로 준비되어 있지만, 실제 연동 전에 서버 계약이 필요합니다.

1. 검색 요청·응답 구조
2. 인덱싱 `stage`와 `progressPercent`
3. `RETRY_WAIT`의 `nextRetryAt`
4. 권한 대상의 표시 이름 또는 사용자 조회 API
5. 문서 목록에서 갱신 시각이 필요하다면 `updatedAt`
6. 중복 버전 정보를 새로고침 후에도 표시하려면 버전 조회 응답의 `duplicateOfVersionNo`
7. SSE에서 `X-User-Id`를 전달할 인증 방식

이 항목이 결정되기 전까지 관련 UI 값은 `src/data/mockData.ts`와 `src/App.tsx`의 mock 로직을 사용합니다.
