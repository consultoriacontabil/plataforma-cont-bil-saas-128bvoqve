import type { NfseFiscalAdapter } from './types'
import { GovBrFiscalAdapter } from './govbrAdapter'
import { BethaFiscalAdapter, GinfesFiscalAdapter } from './extensionAdapters'

export * from './types'
export * from './govbrAdapter'
export * from './extensionAdapters'

/**
 * Fábrica e catálogo de Provedores Fiscais de NFS-e (Adapter Pattern)
 */
export class FiscalAdapterFactory {
  private static adapters: Map<string, NfseFiscalAdapter> = new Map<string, NfseFiscalAdapter>([
    ['governacional', new GovBrFiscalAdapter()],
    ['betha', new BethaFiscalAdapter()],
    ['ginfes', new GinfesFiscalAdapter()],
  ])

  public static getAdapter(id?: string): NfseFiscalAdapter {
    const key = (id || 'governacional').toLowerCase()
    const adapter = this.adapters.get(key)
    if (!adapter) {
      return this.adapters.get('governacional')!
    }
    return adapter
  }

  public static listAdapters(): {
    id: string
    nome: string
    statusDisponibilidade: 'ativo' | 'em_breve'
    descricao: string
  }[] {
    return Array.from(this.adapters.values()).map((a) => ({
      id: a.id,
      nome: a.nome,
      statusDisponibilidade: a.statusDisponibilidade,
      descricao: a.descricao,
    }))
  }
}
