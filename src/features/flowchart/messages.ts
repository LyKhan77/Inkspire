import type { ErrorCode, WarningCode } from './model';
import type { Language } from '../editor/language';

const errors: Record<ErrorCode, [string, string]> = {
  EMPTY: ['Masukkan langkah atau Mermaid dahulu.', 'Enter steps or Mermaid first.'],
  LIMIT: ['Batas flowchart terlampaui: 8.000 karakter, 200 baris, 50 node, 100 konektor, dan label 120 karakter.', 'Flowchart limit exceeded: 8,000 characters, 200 lines, 50 nodes, 100 connections, and 120 characters per label.'],
  LABEL: ['Label kosong, terlalu panjang, atau mengandung format aktif yang tidak didukung.', 'A label is empty, too long, or contains unsupported active formatting.'],
  TEXT_SYNTAX: ['Format langkah tidak valid. Gunakan dua spasi untuk cabang dan -> untuk urutan.', 'Invalid step format. Use two spaces for branches and -> for sequences.'],
  BRANCHES: ['Kondisi memerlukan satu Ya/Yes dan satu Tidak/No dengan langkah tujuan.', 'A condition needs one Yes/Ya and one No/Tidak branch with a destination.'],
  UNKNOWN_NODE: ['Referensi menuju node yang belum didefinisikan.', 'A reference points to a node that has not been defined.'],
  CONFLICT: ['Node didefinisikan ulang dengan label atau bentuk berbeda.', 'A node was redefined with a different label or shape.'],
  MERMAID_SYNTAX: ['Gunakan subset flowchart TD/LR: node proses, kondisi, terminal, dan edge -->.', 'Use the flowchart TD/LR subset: process, decision, terminal nodes, and --> edges.'],
  UNSUPPORTED_OUTPUT: ['Diagram tidak dapat disiapkan sebagai elemen native yang didukung.', 'The diagram cannot be prepared as supported native elements.'],
  CONVERSION_FAILED: ['Preview gagal dibuat. Input tetap tersedia untuk diperbaiki.', 'Could not create the preview. Your input is available for correction.'],
  STALE: ['Workspace berubah. Buat preview lagi sebelum menambahkan.', 'The workspace changed. Create a new preview before adding.'],
};

const warnings: Record<WarningCode, [string, string]> = {
  NO_START: ['Tidak ada terminal Mulai/Start.', 'No Start/Mulai terminal.'],
  UNREACHABLE: ['Node tidak terjangkau dari terminal awal.', 'A node is unreachable from the start terminal.'],
  DECISION_BRANCHES: ['Decision belum memiliki dua cabang dengan label berbeda.', 'A decision does not have two branches with distinct labels.'],
  DEAD_END: ['Proses nonterminal tidak memiliki konektor keluar.', 'A nonterminal process has no outgoing connection.'],
};

export function flowError(language: Language, code: ErrorCode): string { return errors[code][language === 'en' ? 1 : 0]; }
export function flowWarning(language: Language, code: WarningCode): string { return warnings[code][language === 'en' ? 1 : 0]; }
