/** Visualização de um registro a partir da lista. */
export function recordViewPath(listResource: string, recordId: string): string {
  return `/p/${listResource}/record/${recordId}`;
}

export function recordEditPath(listResource: string, recordId: string): string {
  return `/p/${listResource}/record/${recordId}/edit`;
}

/** Relatório de um registro; `reportResource` é o resource da página report. */
export function recordReportPath(
  listResource: string,
  recordId: string,
  reportResource: string,
): string {
  return `/p/${listResource}/record/${recordId}/report/${reportResource}`;
}
