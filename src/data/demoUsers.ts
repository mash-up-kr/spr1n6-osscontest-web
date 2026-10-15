/*
 * Copyright (c) 2026 매쉬업스프링YB
 * SPDX-License-Identifier: MIT
 */

import type { User } from '../types'

// 토큰 발급은 API 범위 밖이므로, 서버에 시드된 데모 사용자 식별자를 사용한다.
// 같은 소속 공유·읽기/쓰기 권한을 보이려면 한 테넌트에 여러 명이, 소속 격리를 보이려면
// 다른 테넌트 사용자가 필요하다. 서버 scripts/seed-demo.sql 과 id·테넌트가 일치해야 한다.
export const demoUsers: User[] = [
  { id: '1', name: '사용자 A', tenant: '테넌트 A', tenantId: '1' },
  { id: '2', name: '사용자 B', tenant: '테넌트 A', tenantId: '1' },
  { id: '3', name: '사용자 C', tenant: '테넌트 A', tenantId: '1' },
  { id: '4', name: '사용자 D', tenant: '테넌트 B', tenantId: '2' },
]
