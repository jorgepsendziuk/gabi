import { useEffect, useState } from 'react';
import { Alert, Button, Card, Field, Input, PageHeader } from '@gabi/ui';
import { apiFetch } from '../lib/api';
import { useModules, type GabiModule } from '../contexts/ModuleContext';

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  sortOrder: 0,
};

export function ModulesPage() {
  const { modules, refreshModules, setActiveModuleId, activeModuleId } = useModules();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (m: GabiModule) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      slug: m.slug,
      description: m.description ?? '',
      icon: m.icon ?? '',
      sortOrder: m.sortOrder,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Salvando...');
    try {
      const body = {
        name: form.name,
        slug: form.slug || undefined,
        description: form.description || undefined,
        icon: form.icon || undefined,
        sortOrder: form.sortOrder,
      };
      if (editingId) {
        await apiFetch(`/api/modules/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
        setMessage('Módulo atualizado.');
      } else {
        await apiFetch('/api/modules', { method: 'POST', body: JSON.stringify(body) });
        setMessage('Módulo criado.');
      }
      resetForm();
      await refreshModules();
    } catch (err) {
      setMessage(String(err));
    }
  };

  const remove = async (m: GabiModule) => {
    if (m.id === 'mod_default') {
      setMessage('O módulo Geral não pode ser removido.');
      return;
    }
    if (!confirm(`Remover módulo "${m.name}"? As páginas irão para o módulo Geral.`)) return;
    try {
      await apiFetch(`/api/modules/${m.id}`, { method: 'DELETE' });
      if (activeModuleId === m.id) setActiveModuleId(null);
      setMessage('Módulo removido.');
      await refreshModules();
    } catch (err) {
      setMessage(String(err));
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Módulos"
        description="Agrupe páginas por área funcional (Social, Ambiental, Cadastro…). O menu lateral mostra módulos e páginas em árvore."
      />

      {message && <Alert className="mb-4">{message}</Alert>}

      <Card padding="lg" className="mb-6">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold m-0">{editingId ? 'Editar módulo' : 'Novo módulo'}</h3>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm text-slate-500 underline">
                Cancelar
              </button>
            )}
          </div>
          <Field label="Nome" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Slug (opcional)">
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="Descrição">
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ícone (emoji opcional)">
              <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
            </Field>
            <Field label="Ordem">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Button type="submit">{editingId ? 'Salvar' : 'Criar módulo'}</Button>
        </form>
      </Card>

      <h3 className="font-semibold mb-3">Módulos cadastrados</h3>
      <ul className="space-y-2">
        {modules.map((m) => (
          <li key={m.id} className="bg-white border rounded-lg p-4 flex justify-between gap-3">
            <div>
              <p className="font-medium m-0">
                {m.icon ? `${m.icon} ` : ''}
                {m.name}
                {m.id === 'mod_default' && (
                  <span className="ml-2 text-xs text-slate-500">(padrão)</span>
                )}
              </p>
              <p className="text-xs text-slate-500 font-mono mt-1">{m.slug}</p>
              {m.description && <p className="text-sm text-slate-600 mt-1">{m.description}</p>}
              <p className="text-xs text-slate-400 mt-1">{m.pageCount ?? 0} página(s)</p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveModuleId(m.id === activeModuleId ? null : m.id)}
              >
                {activeModuleId === m.id ? 'Filtro ativo' : 'Filtrar menu'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => startEdit(m)}>
                Editar
              </Button>
              {m.id !== 'mod_default' && (
                <Button type="button" variant="danger" size="sm" onClick={() => remove(m)}>
                  Remover
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
