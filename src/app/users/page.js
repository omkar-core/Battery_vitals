'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '../../components/Layout'

export default function UsersRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/settings')
  }, [router])

  return (
    <Layout>
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>Redirecting to System Settings...</p>
      </div>
    </Layout>
  )
}
