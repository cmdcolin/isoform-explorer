import type { FeatureGroup } from '../../src/types.ts'

export const GROUP_LABELS: Record<FeatureGroup, string> = {
  targeting: 'Processing, targeting and topology',
  domains: 'Domains and regions',
  sites: 'Sites',
  modifications: 'Modifications',
}

export const GROUPS: FeatureGroup[] = [
  'targeting',
  'domains',
  'sites',
  'modifications',
]
