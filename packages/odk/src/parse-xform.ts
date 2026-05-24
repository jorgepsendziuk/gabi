import { XMLParser } from 'fast-xml-parser';

export interface OdkChoice {
  value: string;
  label: string;
}

export interface OdkFormField {
  /** Caminho no instance, ex: /data/grupo/campo */
  path: string;
  name: string;
  type: string;
  label?: string;
  hint?: string;
  required?: boolean;
  choices?: OdkChoice[];
  /** Coluna física no Postgres (quando cruzado com _form_data_model) */
  dbSchema?: string;
  dbTable?: string;
  dbColumn?: string;
}

export interface ParsedXForm {
  formId?: string;
  fields: OdkFormField[];
  fieldCount: number;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
  isArray: (name) =>
    [
      'input',
      'select1',
      'select',
      'upload',
      'trigger',
      'setvalue',
      'group',
      'repeat',
      'label',
      'hint',
      'item',
      'text',
      'body',
      'span',
      'translation',
      'bind',
    ].includes(name),
});

type XmlNode = Record<string, unknown>;

/** Resolve tag com ou sem prefixo de namespace (h:html, html). */
function pickChild(node: XmlNode | undefined, localName: string): unknown {
  if (!node) return undefined;
  return node[localName] ?? node[`h:${localName}`];
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function textContent(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (typeof node !== 'object') return '';
  const o = node as XmlNode;
  if (typeof o['#text'] === 'string') return o['#text'];
  const spans = asArray(o.span);
  return spans.map((s) => textContent(s)).join('').trim();
}

function buildItextMap(model: XmlNode): Map<string, string> {
  const map = new Map<string, string>();
  const itext = pickChild(model, 'itext') as XmlNode | undefined;
  if (!itext) return map;

  for (const translation of asArray(itext.translation)) {
    const t = translation as XmlNode;
    const lang = String(t.lang ?? 'default');
    if (lang !== 'default' && lang !== 'pt' && !lang.startsWith('pt-')) {
      // prefer default/pt; still index all
    }
    for (const text of asArray(t.text)) {
      const tx = text as XmlNode;
      const id = String(tx.id ?? '');
      if (!id) continue;
      const body = asArray(tx.body)[0] as XmlNode | undefined;
      const label = textContent(body);
      if (label && (!map.has(id) || lang === 'default' || lang.startsWith('pt'))) {
        map.set(id, label);
      }
    }
  }
  return map;
}

function resolveLabel(node: XmlNode, itext: Map<string, string>): string | undefined {
  for (const lab of asArray(node.label)) {
    const l = lab as XmlNode;
    if (l.ref) {
      const id = String(l.ref).replace(/^\/+/, '').split('/').pop() ?? '';
      const fromItext = itext.get(id);
      if (fromItext) return fromItext;
    }
    const inline = textContent(l);
    if (inline) return inline;
  }
  return undefined;
}

function resolveHint(node: XmlNode, itext: Map<string, string>): string | undefined {
  for (const h of asArray(node.hint)) {
    const hint = h as XmlNode;
    if (hint.ref) {
      const id = String(hint.ref).replace(/^\/+/, '').split('/').pop() ?? '';
      return itext.get(id);
    }
    const inline = textContent(hint);
    if (inline) return inline;
  }
  return undefined;
}

function normalizePath(ref: string, instanceRoot = '/data'): string {
  let p = ref.trim();
  if (!p.startsWith('/')) p = `${instanceRoot}/${p}`;
  if (!p.startsWith(instanceRoot)) p = `${instanceRoot}/${p.replace(/^\/+/, '')}`;
  return p.replace(/\/+/g, '/');
}

function pathName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function buildBindMap(model: XmlNode): Map<string, { type: string; required?: boolean }> {
  const map = new Map<string, { type: string; required?: boolean }>();
  for (const bind of asArray(pickChild(model, 'bind') as XmlNode | XmlNode[] | undefined)) {
    const b = bind as XmlNode;
    const nodeset = String(b.nodeset ?? '');
    if (!nodeset) continue;
    const type = String(b.type ?? 'string');
    const required = b.required === 'true()' || b.required === true;
    map.set(normalizePath(nodeset), { type, required });
  }
  return map;
}

function extractChoices(
  node: XmlNode,
  model: XmlNode,
  itext: Map<string, string>,
): OdkChoice[] | undefined {
  const itemsetRef = node.itemset ? String((node.itemset as XmlNode).nodeset ?? '') : '';
  const inlineItems = asArray(node.item);

  if (inlineItems.length > 0) {
    return inlineItems.map((item) => {
      const it = item as XmlNode;
      const value = textContent(it.value) || String(it.value ?? '');
      const label =
        resolveLabel(it, itext) ?? textContent(asArray(it.label)[0]) ?? value;
      return { value, label };
    });
  }

  if (!itemsetRef) return undefined;

  const path = itemsetRef.replace(/^instance\(/, '').replace(/\)$/, '').replace(/^'/, '').replace(/'$/, '');
  const parts = path.split('/').filter(Boolean);
  let cursor: XmlNode = model;
  const instance = (model.instance ?? {}) as XmlNode;
  if (parts[0] === 'instance' && parts.length > 1) {
    cursor = instance;
    parts.shift();
  }
  for (const part of parts) {
    cursor = (cursor[part] as XmlNode) ?? {};
  }

  const items = asArray(cursor.item);
  return items.map((item) => {
    const it = item as XmlNode;
    const value = textContent(it.value) || String(it.value ?? '');
    const label = resolveLabel(it, itext) ?? value;
    return { value, label };
  });
}

const FIELD_TAGS = new Set(['input', 'select1', 'select', 'upload', 'trigger']);

function localTagName(tag: string): string {
  return tag.includes(':') ? (tag.split(':').pop() ?? tag) : tag;
}

/** O parser às vezes coloca o conteúdo do body em chaves numéricas ou um único wrapper. */
function flattenBodyNodes(body: XmlNode): XmlNode[] {
  const nodes: XmlNode[] = [];
  for (const key of Object.keys(body)) {
    if (key === '#text' || key.startsWith('@_')) continue;
    const val = body[key];
    if (/^\d+$/.test(key) && val && typeof val === 'object' && !Array.isArray(val)) {
      nodes.push(val as XmlNode);
      continue;
    }
    nodes.push({ [key]: val } as XmlNode);
  }
  return nodes;
}

function walkBody(
  nodes: XmlNode[] | XmlNode,
  parentPath: string,
  binds: Map<string, { type: string; required?: boolean }>,
  itext: Map<string, string>,
  model: XmlNode,
  fields: OdkFormField[],
): void {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  for (const raw of list) {
    for (const [tag, value] of Object.entries(raw)) {
      if (tag === '#text' || tag.startsWith('@_') || /^\d+$/.test(tag)) {
        if (/^\d+$/.test(tag) && value && typeof value === 'object') {
          walkBody(value as XmlNode, parentPath, binds, itext, model, fields);
        }
        continue;
      }
      const local = localTagName(tag);
      const items = asArray(value as XmlNode);
      for (const node of items) {
        const n = node as XmlNode;
        if (local === 'group' || local === 'repeat') {
          const ref = String(n.ref ?? '');
          const groupPath = ref ? normalizePath(ref, parentPath) : parentPath;
          walkBody(n, groupPath, binds, itext, model, fields);
          continue;
        }

        if (!FIELD_TAGS.has(local)) continue;

        const ref = String(n.ref ?? '');
        if (!ref) continue;
        const path = normalizePath(ref, parentPath);
        const name = pathName(path);
        const bind = binds.get(path);
        const odkType =
          local === 'select1' ? 'select1' : local === 'select' ? 'select' : bind?.type ?? local;
        const choices =
          local === 'select1' || local === 'select' ? extractChoices(n, model, itext) : undefined;

        fields.push({
          path,
          name,
          type: odkType,
          label: resolveLabel(n, itext),
          hint: resolveHint(n, itext),
          required: bind?.required,
          choices,
        });
      }
    }
  }
}

/** Diagnóstico: chaves do documento parseado. */
export function debugXformParseKeys(xml: string): Record<string, string[]> {
  const doc = parser.parse(xml) as XmlNode;
  const root = (pickChild(doc, 'html') ?? doc) as XmlNode;
  const body = (pickChild(root, 'body') ?? {}) as XmlNode;
  return {
    doc: Object.keys(doc),
    html: Object.keys(root),
    body: Object.keys(body).slice(0, 30),
  };
}

export function parseXFormXml(xml: string): ParsedXForm {
  const doc = parser.parse(xml) as XmlNode;
  const root = (pickChild(doc, 'html') ?? doc) as XmlNode;
  const head = (pickChild(root, 'head') ?? {}) as XmlNode;
  const model = (pickChild(head, 'model') ?? {}) as XmlNode;
  const body = (pickChild(root, 'body') ?? {}) as XmlNode;

  const itext = buildItextMap(model);
  const binds = buildBindMap(model);

  const instance = asArray(pickChild(model, 'instance') as XmlNode | XmlNode[] | undefined)[0] as
    | XmlNode
    | undefined;
  let formId: string | undefined;
  if (instance) {
    const data = (instance.data ?? instance) as XmlNode;
    formId = data.id ? String(data.id) : undefined;
  }

  const fields: OdkFormField[] = [];
  const bodyNodes = flattenBodyNodes(body);
  walkBody(bodyNodes, '/data', binds, itext, model as XmlNode, fields);

  return { formId, fields, fieldCount: fields.length };
}
