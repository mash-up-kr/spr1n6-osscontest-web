import type { User } from '../types'

// 토큰 발급은 API 범위 밖이므로, 서버에 시드된 데모 사용자 식별자를 사용한다.
export const demoUsers: User[] = [
  { id: '1', name: '사용자 A', tenant: '테넌트 A', tenantId: '1' },
  { id: '2', name: '사용자 B', tenant: '테넌트 B', tenantId: '2' },
  { id: '3', name: '사용자 C', tenant: '테넌트 C', tenantId: '3' },
]
