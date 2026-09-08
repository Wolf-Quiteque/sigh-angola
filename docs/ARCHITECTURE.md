# Arquitectura da demonstração

- `src/app`: rotas e metadados Next.js; shell partilhada.
- `src/components`: controlos acessíveis, navegação e apresentação.
- `src/features`: ecrãs por capacidade, sem acesso directo ao armazenamento.
- `src/domain`: esquema Zod, tipos e operações puras. Toda a mutação passa pela autorização e regras de consistência antes de receber auditoria e revisão.
- `src/data`: JSON fictício, incluindo unidade, profissionais, pacientes, marcações e episódios. As datas relativas são materializadas no primeiro carregamento para o cenário continuar útil.
- `src/lib/repository.ts`: interface assíncrona e adaptador localStorage versionado. Web Locks serializa gravações entre separadores; revisão detecta estado obsoleto. Sem Web Locks a demo recusa gravações em vez de arriscar concorrência silenciosa. Falhas de armazenamento são explícitas.
- `src/lib/demo-provider.tsx`: estado partilhado, sessão demo e comunicação dos resultados à UI.
- `tests`: regras de domínio e percursos reais no navegador.

Paciente não é marcação. Uma marcação pode ser cancelada sem apagar o paciente. A chegada cria exactamente um episódio. Cada episódio referencia paciente, unidade e, quando aplicável, marcação. Histórico e contadores são calculados das mesmas entidades.

Fase 1 suporta dados locais após carregamento da aplicação e recarregamento com o servidor Next disponível. Não inclui service worker, instalação PWA, sincronização, sessões seguras ou dados clínicos reais. Perfis são uma simulação de UX. O conjunto JSON e exportações são inteiramente fictícios. O reset afecta somente a chave da demo neste navegador.

Interface: fundo branco, cinzas subtis, azul-petróleo como acção principal, tipografia de sistema sem pedidos externos de fontes, navegação lateral, cabeçalho com unidade e perfil, tabelas operacionais e formulários com rótulos. Prioridades/estados são comunicados por texto além de cor.

Base técnica consultada: [instalação oficial do Next.js App Router](https://nextjs.org/docs/app/getting-started/installation). Versões efectivas ficam fixadas em `package-lock.json`.
