import type { User } from '../types'

// 토큰 발급은 API 범위 밖이므로, 서버에 시드된 데모 사용자 식별자를 사용한다.
export const demoUsers: User[] = [
  { id: 'tenant-a-user-a', name: '사용자 A', tenant: '테넌트 A', tenantId: '1' },
  { id: 'tenant-a-user-b', name: '사용자 B', tenant: '테넌트 A', tenantId: '1' },
  { id: 'tenant-b-user-c', name: '사용자 C', tenant: '테넌트 B', tenantId: '2' },
]
