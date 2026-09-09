# Arquitectura da demonstração

- `src/app`: rotas e metadados Next.js; shell partilhada.
- `src/components`: controlos acessíveis, navegação e apresentação.
- `src/features`: ecrãs por capacidade, sem acesso directo ao armazenamento.
- `src/domain`: esquema Zod, tipos e operações puras. Toda a mutação passa pela autorização e regras de consistência antes de receber auditoria e revisão.
- `src/data`: JSON fictício, incluindo unidade, profissionais, pacientes, marcações e episódios. As datas relativas são materializadas no primeiro carregamento para o cenário continuar útil.
- `src/lib/repository.ts`: interface assíncrona e adaptador localStorage versionado. Web Locks serializa gravações entre separadores; revisão detecta estado obsoleto. Sem Web Locks a demo recusa gravações em vez de arriscar concorrência silenciosa. Falhas de armazenamento são explícitas.
- `src/lib/demo-provider.tsx`: estado partilhado, sessão demo e comunicação dos resultados à UI.
- `tests`: regras de domínio e percursos reais no navegador.

Paciente, marcação, episódio, triagem e consulta são entidades distintas ligadas por identificadores. A chegada cria exactamente um episódio; uma triagem avança esse episódio para a fila médica; uma consulta contém prescrições e, ao terminar, encerra o episódio. Registos finalizados recebem adendas imutáveis em vez de edição directa. Histórico e contadores são calculados destas mesmas entidades.

Fases 1 e 2 suportam dados locais após carregamento da aplicação e recarregamento com o servidor Next disponível. Não inclui service worker, instalação PWA, sincronização, sessões seguras ou utilização de dados clínicos reais. Perfis são uma simulação de UX. O conjunto JSON e exportações são inteiramente fictícios. O reset afecta somente a chave da demo neste navegador. Ao abrir dados da fase 1, o repositório migra o esquema para a versão 2, preservando pacientes, marcações, episódios, auditoria e revisão.

Interface: fundo branco, cinzas subtis, azul-petróleo como acção principal, tipografia de sistema sem pedidos externos de fontes, navegação lateral, cabeçalho com unidade e perfil, tabelas operacionais e formulários com rótulos. Prioridades/estados são comunicados por texto além de cor.

Base técnica consultada: [instalação oficial do Next.js App Router](https://nextjs.org/docs/app/getting-started/installation). Versões efectivas ficam fixadas em `package-lock.json`.
