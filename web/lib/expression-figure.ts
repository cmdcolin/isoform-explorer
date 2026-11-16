import { expressionOf, tissuesNamed } from './expression.ts'
import { shareChart } from './share-chart.ts'

export const FIGURE_TISSUES = new Map([
  ['Brain - Cerebellar Hemisphere', 'Cerebellar hemisphere'],
  ['Brain - Frontal Cortex (BA9)', 'Frontal cortex'],
  ['Brain - Hypothalamus', 'Hypothalamus'],
  ['Nerve - Tibial', 'Tibial nerve'],
  ['Muscle - Skeletal', 'Skeletal muscle'],
  ['Heart - Left Ventricle', 'Heart left ventricle'],
  ['Thyroid', 'Thyroid'],
  ['Lung', 'Lung'],
  ['Adrenal Gland', 'Adrenal gland'],
  ['Skin - Not Sun Exposed (Suprapubic)', 'Skin'],
  ['Liver', 'Liver'],
  ['Whole Blood', 'Whole blood'],
])

function labelled(tissues: ReturnType<typeof tissuesNamed>) {
  return tissues.map(t => ({ ...t, label: FIGURE_TISSUES.get(t.tissue) }))
}

export function expressionFigure() {
  const app = expressionOf('P05067-4')
  const ndufc2 = expressionOf('O95298-2')
  return shareChart([
    {
      title: 'APP695 (P05067-4), no Kunitz domain',
      subtitle: 'skips exons 7 and 8',
      tissues: labelled(tissuesNamed(app, [...FIGURE_TISSUES.keys()])),
    },
    {
      title: 'NDUFC2 isoform 4 (O95298-2), no membrane helix',
      subtitle: `its junction is in ${ndufc2.isoformSamples} of ${ndufc2.samples.toLocaleString()} GTEx samples`,
      tissues: labelled(tissuesNamed(ndufc2, [...FIGURE_TISSUES.keys()])),
    },
  ])
}
