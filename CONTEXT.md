# History Sim — Contexto

Protótipo de educação gamificada: quem joga entra numa cena histórica e conversa com personagens de IA ancorados em fontes. Referência de arquitetura: série PhiloAgents ([transcripts](philoagents-transcripts.md)).

Status: planejamento fechado em 2026-10-22 (sessão de grilling). Pesquisa de fatos e implementação pendentes.

## Pergunta que a v1 responde

O modelo grátis (Workers AI) produz personagens críveis **e fiéis às fontes**? Medido por [docs/fidelity-eval.md](docs/fidelity-eval.md). Engajamento e demo comercial ficam para depois.

## Produto

- **Público:** ensino médio, 15–17 anos.
- **Idioma:** pt-br.
- **Papel de quem joga:** investigador do futuro. Congela o tempo e caminha entre pessoas paradas. Só observa; não altera a história. A intro avisa que a calma dos personagens é licença ficcional.
- **Objetivo de aprendizado:** pensar como historiador (comparar versões, achar viés e contradição). Conteúdo: causas da Primeira Guerra.
- **Cena v1:** rua de Sarajevo, logo após os tiros, 28/06/1914. Mito a desmontar: Princip comendo sanduíche.
- **Elenco v1:**
  - Gavrilo Princip
  - Franz von Harrach — no estribo do carro
  - Oskar Potiorek — governador da Bósnia, no carro; mudou a rota
  - Luigi Albertini (m. 1941) — coro, fora da cena
- **Fora da v1:** historiadores vivos (nunca), personagens inventados (backlog).

## Regras de fidelidade

1. Só fontes livres: domínio público, Wikipedia (CC BY-SA), documentos da época. Nenhum livro moderno com copyright no corpus.
2. Pergunta sem cobertura nas fontes → personagem diz, no papel, que não sabe. Nunca inventa.
3. Corte temporal: personagens da cena sabem até o instante do congelamento; Albertini até 1941. Princip não sabe que haverá guerra.
4. Princip: convicto, na voz dele. Sem detalhar violência, sem incentivar quem joga. Contraponto vem das outras vozes, não de um Princip arrependido.
5. Cada resposta mostra a fonte (trecho recolhível).
6. Personagens isolados: cada um só conhece o próprio ponto de vista e o que quem joga contar. Informação de segunda mão é recebida com desconfiança.

## Glossário de nomes

- **Pessoas:** sempre no original. Ex.: Franz Ferdinand, Gavrilo Princip, Sophie Chotek.
- **Lugares e organizações:** nome usual em pt-br + original entre parênteses na primeira menção. Ex.: Ponte Latina (Latinska ćuprija), Mão Negra (Crna ruka).
- O glossário vai no prompt de sistema de cada personagem.

| Termo pt-br | Original | Tipo |
|---|---|---|
| Ponte Latina | Latinska ćuprija | lugar |
| Mão Negra | Crna ruka | organização |
| Jovem Bósnia | Mlada Bosna | organização |

## Arquitetura v1

- **Hospedagem:** Cloudflare, plano grátis.
  - Workers — API + WebSocket
  - Durable Objects — um por `(playerId, characterId)`; histórico isolado
  - Workers AI — chat e embeddings
  - Vectorize — busca por sentido no corpus
  - AI Gateway — logs, cache, troca de provedor
- **Fluxo do personagem (sem framework):** buscar trechos → montar prompt → responder em stream com fonte. Sem LangGraph.
- **Provedores de IA (Adapter + Strategy):**
  - `ChatProvider` — conversa em stream
  - `EmbeddingProvider` — vetores; trocar o modelo exige reindexar o corpus
  - Adapters: `WorkersAiProvider` (padrão), `OpenRouterProvider` (fallback pago, créditos existentes)
  - Seleção por variável de ambiente
- **Acesso:** código de acesso + rate limit diário por pessoa (protege a cota grátis).
- **Tela:** página única — intro, lista dos 4 personagens, chat por personagem, fonte recolhível. Sem login; `playerId` no `localStorage`. Sem memória entre sessões.

## Fatos a verificar antes de implementar

Pesquisa feita em 2026-10-25.

- [x] **Horário dos tiros:** nenhuma fonte primária achada dá o minuto. Secundárias: bomba às 10h10 (Dedijer 1966), saída da prefeitura ~10h45, tiros ~10h50–10h55 (Dash), mortes até 11h30 (McMeekin 2013). Usar "pouco antes das 11h"; nunca um minuto exato.
- [x] **Harrach:** fica. Depoimento lido no julgamento, em alemão, em Pharos, *Der Prozeß gegen die Attentäter von Sarajewo* (Berlim, 1918), p. 158–159 — domínio público ([archive.org](https://archive.org/details/derprozessgegend01prin)). Cobre: estribo esquerdo, tiro antes da bomba, "Sopherl… bleibe am Leben für unsere Kinder", "Es ist nichts!". A tradução inglesa da firstworldwar.com não diz a origem; não usar.
- [x] **Lojka:** nenhum relato em primeira pessoa em fonte livre. Pharos não traz o depoimento dele. As "notas privadas" citadas na *profil* não têm origem nem são livres. Só sobra a Wikipedia (terceira pessoa). Entrevistas dos anos 1920 podem estar no ANNO (jornais austríacos digitalizados); não buscado. **Saiu do elenco em 2026-10-26** (ver backlog).
- [x] **Potiorek entra no lugar de Lojka.** Estava no mesmo carro. Depoimento longo em primeira pessoa em Pharos, p. 155–158 (ordem ao chauffeur para não virar, tiros vindos da direita, Sophie caindo). Também é ele quem mudou a rota — bom para "achar viés".
- [x] **Princip:** Pharos traz o interrogatório dele no julgamento (out/1914). É depois do congelamento; usar só o que ele já sabia em 28/06.
- [x] **Mito do sanduíche:** nenhuma fonte da época. Mais antiga achada: o romance *O homem que matou Getúlio Vargas*, de Jô Soares (1998; em inglês *Twelve Fingers*, 2001). Espalhou com o documentário da BBC *Days That Shook the World* (2003). Testemunha Milan Drnić, à porta da Schiller, viu Princip com a pistola; nenhum sanduíche. Fonte: Mike Dash (2011), Wikipedia.
- [x] **Plano grátis Cloudflare:**
  - Workers AI: 10.000 neurons/dia por conta, reset 00h UTC; passou → erro. Llama 3.3 70B fp8: 26.668 in / 204.805 out por M tokens. Llama 3.1 8B fp8: 13.778 / 26.128.
  - Estimativa por resposta (~3k tokens in, ~300 out): 70B ≈ 140 neurons → **~70 respostas/dia na conta toda**; 8B ≈ 50 → ~200/dia. Uma turma de 30 esgota o 70B rápido, e o eval também gasta da mesma cota.
  - Embeddings: os `bge-*-en` são só inglês. Corpus em alemão/inglês + pergunta em pt-br pede `@cf/baai/bge-m3` (multilíngue, 1024 dim).
  - Vectorize: 5M dimensões guardadas (~4.800 trechos com bge-m3), 30M consultadas/mês.
  - Durable Objects: grátis só com SQLite. 100k requests/dia, 100k linhas escritas/dia, 5 GB. Usar a Hibernation API no WebSocket.
- [x] **AI Gateway + OpenRouter:** suportado. `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openrouter`.
