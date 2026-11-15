import type { FeatureGroup } from '../../src/types.ts'

export const GROUP_LABELS: Record<FeatureGroup, string> = {
  targeting: 'Processing, targeting and topology',
  domains: 'Domains and regions',
  sites: 'Sites',
  modifications: 'Modifications',
}

export const GROUP_MISSING: Record<FeatureGroup, string> = {
  targeting: 'missing a whole processing, targeting or topology feature',
  domains: 'missing a whole domain or region',
  sites: 'missing a site',
  modifications: 'missing a modified residue or bond',
}

export const GROUPS: FeatureGroup[] = [
  'targeting',
  'domains',
  'sites',
  'modifications',
]
