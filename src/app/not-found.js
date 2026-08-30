'use client'
import Link from 'next/link'
import { BatteryWarning } from 'lucide-react'
import Layout from '../components/Layout'
import styles from '../styles/pages.module.css'

export default function NotFound() {
  return (
    <Layout connected={false}>
      <div className={styles.empty} style={{ padding: 60 }}>
        <BatteryWarning size={40} color="#FF2D55" style={{ marginBottom: 12 }} />
        <h1 style={{ fontSize: 34, color: 'var(--text-primary)', marginBottom: 8 }}>404</h1>
        <p style={{ marginBottom: 20 }}>
          This battery cell is empty — the page you are looking for does not exist.
        </p>
        <Link href="/" className={styles.primaryBtn} style={{ display: 'inline-flex' }}>
          Back to Dashboard
        </Link>
      </div>
    </Layout>
  )
}