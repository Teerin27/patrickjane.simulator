import type { CSSProperties } from 'react'
import { nine } from './pixel'

// Nine-slice border images used by .panel and .btn in index.css
export const stageVars = {
  '--n-paper': nine('#E6D5AE', '#F4ECD8', '#C4A97A', 3),
  '--n-card': nine('#C4A97A', '#E6D5AE', '#8A6E4B', 3),
  '--n-dark': nine('#1B2033', '#2C3350', '#0F1220', 3),
  '--b-paper': nine('#E6D5AE', '#F4ECD8', '#8A6E4B', 2),
  '--b-paper-d': nine('#E6D5AE', '#8A6E4B', '#F4ECD8', 2),
  '--b-amber': nine('#F2B33D', '#FFD97A', '#C27C1E', 2),
  '--b-amber-d': nine('#F2B33D', '#C27C1E', '#FFD97A', 2),
  '--b-crimson': nine('#C8323C', '#FFD97A', '#7A1E2A', 2),
  '--b-crimson-d': nine('#C8323C', '#7A1E2A', '#FFD97A', 2),
  '--b-teal': nine('#4FA3A0', '#8FD6D2', '#2D6466', 2),
  '--b-teal-d': nine('#4FA3A0', '#2D6466', '#8FD6D2', 2),
  '--b-off': nine('#8A6E4B', '#C4A97A', '#2C3350', 2),
} as CSSProperties
