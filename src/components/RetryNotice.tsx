/*
 * Copyright (c) 2026 매쉬업스프링YB
 * SPDX-License-Identifier: MIT
 */

import { useSyncExternalStore } from 'react'
import { isRetrying, subscribeRetrying } from '../api/client'

// 조회를 다시 요청하는 동안만 보인다. 사용자에게는 원인 대신 기다리면 된다는 것만 알린다.
export function RetryNotice() {
  const retrying = useSyncExternalStore(subscribeRetrying, isRetrying)
  if (!retrying) return null
  return <div className="toast retry-notice" role="status"><span aria-hidden="true">◷</span>응답이 늦어지고 있습니다. 잠시만 기다려 주세요.</div>
}
