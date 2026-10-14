import type { Case, Service, OdontogramSelection } from '../types';

export interface SimilarityResult {
  isMatch: boolean;
  matchType: 'identical' | 'similar';
  score: number;
  reason: string;
}

export interface DuplicateMatch {
  caseItem: Case;
  matchType: 'identical' | 'similar';
  score: number;
  reason: string;
}

const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'dr', 'dra', 'sr', 'sra']);

export function normalizePatientName(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

export function checkPatientSimilarity(name1: string, name2: string): SimilarityResult | null {
  const n1 = normalizePatientName(name1);
  const n2 = normalizePatientName(name2);
  if (!n1 || !n2) return null;

  // 1. Exact match
  if (n1 === n2) {
    return {
      isMatch: true,
      matchType: 'identical',
      score: 1.0,
      reason: 'Nome idêntico'
    };
  }

  // Tokenize without stop words
  const words1 = n1.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w));
  const words2 = n2.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w));

  const clean1 = words1.join(' ');
  const clean2 = words2.join(' ');

  // 2. Exact match ignoring particles/prepositions (e.g., "Ana Paula Souza" vs "Ana Paula de Souza")
  if (clean1 && clean2 && clean1 === clean2) {
    return {
      isMatch: true,
      matchType: 'identical',
      score: 0.99,
      reason: 'Nome idêntico (ignorando partículas/prefixos)'
    };
  }

  // 3. Full-string Levenshtein similarity
  const maxLen = Math.max(n1.length, n2.length);
  const dist = levenshteinDistance(n1, n2);
  const fullSimilarity = 1 - dist / maxLen;

  if (maxLen >= 5 && fullSimilarity >= 0.80) {
    return {
      isMatch: true,
      matchType: 'similar',
      score: fullSimilarity,
      reason: `Grafia muito semelhante (${Math.round(fullSimilarity * 100)}%)`
    };
  }

  // 4. Word-based comparisons
  if (words1.length > 0 && words2.length > 0) {
    // Both single word (e.g. "Claudio" vs "Claudia")
    if (words1.length === 1 && words2.length === 1) {
      const w1 = words1[0];
      const w2 = words2[0];
      const wMax = Math.max(w1.length, w2.length);
      const wDist = levenshteinDistance(w1, w2);
      const sim = 1 - wDist / wMax;
      if (sim >= 0.80 && wMax >= 4) {
        return {
          isMatch: true,
          matchType: 'similar',
          score: sim,
          reason: `Grafia muito semelhante (${Math.round(sim * 100)}%)`
        };
      }
      return null;
    }

    // Token match with fuzzy word comparison (e.g., "Matheus" matches "Mateus")
    let matchedWordCount = 0;
    const usedIndices2 = new Set<number>();

    for (const w1 of words1) {
      let bestMatchIdx = -1;
      let bestSim = 0;
      for (let i = 0; i < words2.length; i++) {
        if (usedIndices2.has(i)) continue;
        const w2 = words2[i];
        if (w1 === w2) {
          bestMatchIdx = i;
          bestSim = 1;
          break;
        }
        const maxW = Math.max(w1.length, w2.length);
        if (maxW >= 4) {
          const d = levenshteinDistance(w1, w2);
          const sim = 1 - d / maxW;
          if (sim >= 0.80 && sim > bestSim) {
            bestSim = sim;
            bestMatchIdx = i;
          }
        }
      }
      if (bestMatchIdx !== -1) {
        matchedWordCount++;
        usedIndices2.add(bestMatchIdx);
      }
    }

    const minWords = Math.min(words1.length, words2.length);
    const maxWords = Math.max(words1.length, words2.length);

    // If all words of the shorter name are in the longer name (e.g. "Lucia" and "Lucia Maria", or "Lucas Gabriel Pereira" and "Lucas Pereira")
    if (matchedWordCount === minWords && minWords >= 1) {
      // For single-word, ensure the matched word is meaningful (>= 3 chars)
      const shorterWords = words1.length <= words2.length ? words1 : words2;
      const isMeaningful = shorterWords.every(w => w.length >= 3);
      if (isMeaningful) {
        return {
          isMatch: true,
          matchType: 'similar',
          score: minWords / maxWords,
          reason: minWords === 1 ? 'Primeiro/único nome contido no cadastro existente' : 'Nome contido no cadastro existente'
        };
      }
    }

    // Direct containment of full normalized names if >= 3 characters (e.g. "lucia" in "lucia maria")
    if (n1.length >= 3 && n2.length >= 3) {
      if (n1.startsWith(n2 + ' ') || n1.endsWith(' ' + n2) || n1.includes(' ' + n2 + ' ')) {
        return {
          isMatch: true,
          matchType: 'similar',
          score: n2.length / n1.length,
          reason: 'Nome contido no cadastro existente'
        };
      }
      if (n2.startsWith(n1 + ' ') || n2.endsWith(' ' + n1) || n2.includes(' ' + n1 + ' ')) {
        return {
          isMatch: true,
          matchType: 'similar',
          score: n1.length / n2.length,
          reason: 'Nome contido no cadastro existente'
        };
      }
    }

    // First and last names match (e.g. "Joao Pedro Silva" and "Joao Paulo Silva")

    // First and last names match (e.g. "Joao Pedro Silva" and "Joao Paulo Silva")
    const firstWordMatch = (words1[0] === words2[0]) || (Math.max(words1[0].length, words2[0].length) >= 4 && levenshteinDistance(words1[0], words2[0]) <= 1);
    const lastWordMatch = (words1[words1.length - 1] === words2[words2.length - 1]) || (Math.max(words1[words1.length - 1].length, words2[words2.length - 1].length) >= 4 && levenshteinDistance(words1[words1.length - 1], words2[words2.length - 1]) <= 1);

    if (firstWordMatch && lastWordMatch && matchedWordCount >= 2) {
      return {
        isMatch: true,
        matchType: 'similar',
        score: matchedWordCount / maxWords,
        reason: 'Primeiro nome e sobrenome coincidentes'
      };
    }

    // High proportion of matching tokens
    if (matchedWordCount >= 2 && (matchedWordCount / maxWords) >= 0.65) {
      return {
        isMatch: true,
        matchType: 'similar',
        score: matchedWordCount / maxWords,
        reason: 'Nomes e sobrenomes coincidentes'
      };
    }
  }

  return null;
}

export function findDuplicateCases(
  inputName: string,
  dentistId: string,
  allCases: Case[],
  currentCaseId?: string
): DuplicateMatch[] {
  if (!inputName || !inputName.trim() || !dentistId) {
    return [];
  }

  const matches: DuplicateMatch[] = [];

  for (const c of allCases) {
    // Only check cases for the same dentist
    if (c.dentist_id !== dentistId) continue;
    // Exclude the case itself when editing
    if (currentCaseId && c.id === currentCaseId) continue;

    const res = checkPatientSimilarity(inputName, c.patient_name);
    if (res && res.isMatch) {
      matches.push({
        caseItem: c,
        matchType: res.matchType,
        score: res.score,
        reason: res.reason
      });
    }
  }

  // Sort: identical first, then highest score, then most recent created_at
  matches.sort((a, b) => {
    if (a.matchType !== b.matchType) {
      return a.matchType === 'identical' ? -1 : 1;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(b.caseItem.created_at).getTime() - new Date(a.caseItem.created_at).getTime();
  });

  return matches;
}

export function formatTeethSelection(selection?: OdontogramSelection): string {
  if (!selection || !selection.teeth || selection.teeth.length === 0) {
    return 'Nenhum elemento selecionado';
  }

  const { teeth, type } = selection;
  const sortedTeeth = [...teeth].sort((a, b) => a - b);

  if (type === 'todos') {
    return `Todos os dentes (${sortedTeeth.length} elementos)`;
  }
  if (type === 'superior') {
    return `Arcada Superior (${sortedTeeth.length} elementos: ${sortedTeeth.join(', ')})`;
  }
  if (type === 'inferior') {
    return `Arcada Inferior (${sortedTeeth.length} elementos: ${sortedTeeth.join(', ')})`;
  }
  if (type === 'protocolo_superior') {
    return `Protocolo Superior (${sortedTeeth.join(', ')})`;
  }
  if (type === 'protocolo_inferior') {
    return `Protocolo Inferior (${sortedTeeth.join(', ')})`;
  }
  if (type === 'ponte') {
    return `Ponte nos dentes: ${sortedTeeth.join(', ')}`;
  }

  return `${sortedTeeth.length} elemento${sortedTeeth.length > 1 ? 's' : ''}: ${sortedTeeth.join(', ')}`;
}

export function formatCaseServices(selectedServices: string[] | undefined, allServices: Service[]): string {
  if (!selectedServices || selectedServices.length === 0) {
    return 'Nenhum procedimento informado';
  }

  const resolved = selectedServices.map(item => {
    let serviceId = item;
    let qty = 1;
    if (item.includes(':')) {
      const parts = item.split(':');
      serviceId = parts[0];
      qty = parseInt(parts[1], 10) || 1;
    }

    const srv = allServices.find(s => s.id === serviceId);
    if (!srv) return item;
    return qty > 1 ? `${srv.name} (${qty}x)` : srv.name;
  });

  return resolved.join(', ');
}

export function formatCaseDate(dateStr?: string): string {
  if (!dateStr) return 'Não informada';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}
