[한국어](CONTRIBUTING.md) | [English](CONTRIBUTING_EN.md)

# Contributing guide

This describes the procedure to follow when working in this repository. The standards for writing code are in [docs/CODE_CONVENTIONS_EN.md](docs/CODE_CONVENTIONS_EN.md), and how to set up your development environment and run the app is in [Running](README_EN.md#running) of the README, and the screen regression checks are in [API permission responses](README_EN.md#api-permission-responses).

---

## Contribution flow

1. Open an [issue](https://github.com/mash-up-kr/spr1n6-osscontest-web/issues/new/choose) first. Use the Bug report form for bugs and the Feature request form for suggestions.
2. Comment on the issue you want to work on, then branch off of `main`. Include the issue number in the branch name. (`fix/123-upload-limit`)
3. Write `Closes #123` under Related Issue in the PR body. The issue closes when the PR is merged.

Small changes such as typo or documentation fixes can go straight to a PR without an issue.

Do not report security vulnerabilities as issues. Report them privately as described in the [security policy](SECURITY_EN.md).

## Branches

| Branch | Purpose |
|--------------|-------------|
| `main` | Integration branch |
| `feat/*` | Feature development |
| `fix/*` | Bug fixes |
| `refactor/*` | Refactoring |
| `docs/*` | Documentation work |
| `chore/*` | Config, build, dependencies |

Branch off of `main` for your work, and merge back into `main` via a PR when done.

## Commit messages

The subject line follows the `<type>: <subject>` format. The body is free-form.

```
feat: DB 장애 전환 중 503을 받은 조회를 Retry-After 간격으로 재시도
fix: 검색도 503 재시도 대상에 넣고 인덱싱 상태 폴링은 재시도에서 제외
docs: README를 현재 코드에 맞게 수정
refactor: 코드 주석을 컨벤션에 맞게 정리
test: 권한별 화면 회귀 검증 추가
chore: MIT 라이선스와 파일 헤더 추가
```

Don't mix cleanup commits (comments, naming, dead code) with commits that change behavior. Mixing them makes it impossible to tell, during review, whether something was moved or actually changed.

## Pull Request

Follow `.github/pull_request_template.md`. In the body, describe what the problem was, how to reproduce it, what was fixed, and how it was verified.

Split PRs by root cause. Only bundle changes together when they can't stand on their own without each other.

Record any deliberation over design or alternatives considered in the PR body, not in code comments. Comments should stay focused on what the code does.
