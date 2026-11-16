import type { Disease } from '../../src/types.ts'
import { diseases } from './data.ts'
import { href } from './site.ts'

let byPage: Map<string, Disease[]> | undefined

export function diseasesOfPage(page: string) {
  byPage ??= diseases().reduce((map, disease) => {
    for (const { page: linked } of disease.genes) {
      map.set(linked, [...(map.get(linked) ?? []), disease])
    }
    return map
  }, new Map<string, Disease[]>())
  return byPage.get(page) ?? []
}

export function diseaseHref(disease: Pick<Disease, 'slug'>) {
  return href(`disease/${disease.slug}/`)
}
