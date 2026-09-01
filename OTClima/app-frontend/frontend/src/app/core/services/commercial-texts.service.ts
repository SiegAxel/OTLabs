import { Injectable } from '@angular/core';
import { Company } from '../models';

export type CommercialTextKind = 'conditions' | 'warranties';

export interface CommercialTextOption {
  id: string;
  title: string;
  content: string;
  active: boolean;
  isDefault: boolean;
}

type CommercialTextCatalog = Record<CommercialTextKind, CommercialTextOption[]>;

@Injectable({ providedIn: 'root' })
export class CommercialTextsService {
  private readonly storageKey = 'otclima_commercial_texts';

  getCatalog(company?: Company | null): CommercialTextCatalog {
    const stored = this.read();
    const seeded = this.seedFromCompany(stored, company);
    this.write(seeded);
    return seeded;
  }

  saveCatalog(catalog: CommercialTextCatalog) {
    this.write({
      conditions: this.normalize(catalog.conditions),
      warranties: this.normalize(catalog.warranties),
    });
  }

  activeOptions(kind: CommercialTextKind, company?: Company | null): CommercialTextOption[] {
    return this.getCatalog(company)[kind].filter((option) => option.active);
  }

  defaultText(kind: CommercialTextKind, company?: Company | null): string {
    const options = this.activeOptions(kind, company);
    return options.find((option) => option.isDefault)?.content ?? options[0]?.content ?? '';
  }

  private read(): CommercialTextCatalog {
    const empty: CommercialTextCatalog = { conditions: [], warranties: [] };
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return empty;

    try {
      const parsed = JSON.parse(raw) as Partial<CommercialTextCatalog>;
      return {
        conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
        warranties: Array.isArray(parsed.warranties) ? parsed.warranties : [],
      };
    } catch {
      return empty;
    }
  }

  private seedFromCompany(catalog: CommercialTextCatalog, company?: Company | null): CommercialTextCatalog {
    return {
      conditions: this.seedList(catalog.conditions, company?.quote_conditions, 'Condiciones por defecto'),
      warranties: this.seedList(catalog.warranties, company?.quote_warranty, 'Garantia por defecto'),
    };
  }

  private seedList(list: CommercialTextOption[], fallback: string | undefined, title: string): CommercialTextOption[] {
    if (list.length > 0) return this.normalize(list);
    const content = fallback?.trim();
    if (!content) return [];

    return [
      {
        id: this.nextId(),
        title,
        content,
        active: true,
        isDefault: true,
      },
    ];
  }

  private normalize(list: CommercialTextOption[]): CommercialTextOption[] {
    const cleaned = list
      .map((option) => ({
        ...option,
        title: option.title?.trim() || 'Sin titulo',
        content: option.content?.trim() || '',
      }))
      .filter((option) => option.content);

    const defaultIndex = cleaned.findIndex((option) => option.isDefault);
    return cleaned.map((option, index) => ({
      ...option,
      active: option.isDefault ? true : option.active,
      isDefault: defaultIndex === -1 ? index === 0 : index === defaultIndex,
    }));
  }

  private write(catalog: CommercialTextCatalog) {
    localStorage.setItem(this.storageKey, JSON.stringify(catalog));
  }

  nextId(): string {
    return `${Date.now()}-${Math.round(Math.random() * 100000)}`;
  }
}
