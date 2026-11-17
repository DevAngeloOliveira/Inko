/**
 * Curadoria editorial do INKO (manifestos versionados em `data/seeds`).
 *
 * Título, autoria, categoria, volume e disponibilidade vêm sempre do serviço de
 * Catálogo e da Circulação. Daqui saem apenas metadados editoriais ligados por ID:
 * gêneros, sinopse, referência bibliográfica, coleções, campanhas e adaptações
 * em anime. Nada aqui substitui ou duplica o registro de uma obra.
 */

import catalogManifest from '../../../data/seeds/catalogo-obras.json';
import animeManifest from '../../../data/seeds/adaptacoes-anime.json';
import editorialManifest from '../../../data/seeds/colecoes-editoriais.json';
import type { Category } from './demo';

export interface EditorialWork {
  genres: readonly string[];
  synopsis: string;
  franchise?: string;
  reference?: { source: string; url: string };
}

export interface AnimeAdaptation {
  id: string;
  title: string;
  mangaId: string;
  studios: readonly string[];
  year: number;
  referenceUrl: string;
}

export interface EditorialFilter {
  category?: Category;
  collection?: string;
}

export interface Campaign {
  id: string;
  label: string;
  title: string;
  text: string;
  cta: string;
  filter: EditorialFilter;
  works: readonly string[];
  tone: 'seal' | 'ink' | 'paper' | 'graphite';
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  works: readonly string[];
}

export const GENRES: readonly string[] = catalogManifest.generos;

const BY_ID = new Map<string, EditorialWork>(catalogManifest.obras.map(work => [work.id, {
  genres: work.generos,
  synopsis: work.sinopseCurta,
  franchise: 'franquia' in work ? work.franquia : undefined,
  reference: 'referencia' in work && work.referencia ? { source: work.referencia.fonte, url: work.referencia.url } : undefined,
}]));

export const ANIME: readonly AnimeAdaptation[] = animeManifest.adaptacoes.map(item => ({
  id: item.id, title: item.titulo, mangaId: item.mangaId, studios: item.estudios, year: item.anoEstreia, referenceUrl: item.referencia.url,
}));

function toFilter(filtro: { categoria?: string; colecao?: string }): EditorialFilter {
  if (filtro.colecao) return { collection: filtro.colecao };
  if (filtro.categoria === 'Mangá' || filtro.categoria === 'HQ' || filtro.categoria === 'Graphic novel') return { category: filtro.categoria };
  return {};
}

export const CAMPAIGNS: readonly Campaign[] = editorialManifest.campanhas.map(item => ({
  id: item.id, label: item.rotulo, title: item.titulo, text: item.texto, cta: item.cta,
  filter: toFilter(item.filtro), works: item.obras, tone: item.tom as Campaign['tone'],
}));

export const COLLECTIONS: readonly Collection[] = editorialManifest.colecoes.map(item => ({
  id: item.id, title: item.titulo, description: item.descricao, works: item.obras,
}));

export function editorialOf(workId: string): EditorialWork | undefined {
  return BY_ID.get(workId);
}

export function animeOf(workId: string): AnimeAdaptation | undefined {
  return ANIME.find(item => item.mangaId === workId);
}

export function collectionById(id: string): Collection | undefined {
  return COLLECTIONS.find(collection => collection.id === id);
}
