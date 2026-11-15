import type { FeatureGroup } from '../../src/types.ts'

export const GROUP_LABELS: Record<FeatureGroup, string> = {
  targeting: 'Targeting and topology',
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
