import { Link } from 'react-router-dom';
import { useIsAuthenticated } from '@refinedev/core';
import { Badge, Card } from '@gabi/ui';

const features = [
  {
    title: 'Listagens',
    desc: 'Busca, filtros, paginação e exportação reutilizáveis em qualquer entidade.',
  },
  {
    title: 'Mapas',
    desc: 'Camadas geoespaciais e visualização integrada ao seu banco PostGIS.',
  },
  {
    title: 'Geração rápida',
    desc: 'Introspecção do schema e scaffolding de páginas em minutos.',
  },
  {
    title: 'Governança',
    desc: 'Autenticação, controle de acesso e trilha de auditoria desde o núcleo.',
  },
];

export function LandingPage() {
  const { data: isAuth } = useIsAuthenticated();
  const painelTo = isAuth?.authenticated ? '/app' : '/login';

  return (
    <div className="min-h-screen flex flex-col bg-gabi-bg">
      <header className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <img src="/favicon-48.png" alt="GABI" className="h-10 w-10 rounded-lg" />
          <span className="font-semibold text-gabi-primary">GABI</span>
        </div>
        <Link to={painelTo} className="gabi-btn gabi-btn--accent gabi-btn--sm">
          {isAuth?.authenticated ? 'Abrir painel' : 'Entrar'}
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 pb-16">
        <section className="max-w-2xl text-center mt-12 md:mt-20">
          <img
            src="/gabi.png"
            alt="GABI"
            className="h-20 w-20 mx-auto mb-6 rounded-2xl shadow-sm"
          />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gabi-primary mb-3">
            Geo-Aplicações &amp; Business Intelligence
          </h1>
          <p className="text-lg text-gabi-muted leading-relaxed">
            Framework mínimo para construir ERPs geoespaciais modernos com React e Node —
            sem reinventar listagens, mapas e relatórios a cada projeto.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={painelTo} className="gabi-btn gabi-btn--primary gabi-btn--lg">
              Começar agora
            </Link>
            <a href="#recursos" className="gabi-btn gabi-btn--outline gabi-btn--lg">
              Ver recursos
            </a>
          </div>
        </section>

        <section id="recursos" className="w-full max-w-4xl mt-20 md:mt-28">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-gabi-muted mb-8">
            O que o GABI oferece
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <Card key={f.title} hover padding="md">
                <h3 className="font-semibold text-gabi-accent mb-1.5">{f.title}</h3>
                <p className="text-sm text-gabi-muted leading-relaxed m-0">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="w-full max-w-2xl mt-16 text-center">
          <Badge variant="accent" className="mb-4 normal-case tracking-normal text-sm">
            React · Node · PostGIS · TypeScript
          </Badge>
          <p className="text-sm text-gabi-muted m-0">
            Conecte seu banco, introspecte tabelas e publique listagens e mapas — tudo a partir de
            um painel administrativo enxuto.
          </p>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-gabi-muted border-t border-[var(--gabi-border)]">
        GABI Framework — ERPs geoespaciais com menos boilerplate
      </footer>
    </div>
  );
}
