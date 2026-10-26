# Backlog

Fora da v1 por decisão, não por esquecimento. Ver [CONTEXT.md](../CONTEXT.md).

## Caderno do investigador

Núcleo do loop de jogo; cortado da v1 para isolar o teste de fidelidade.

- Salvar falas como "pistas"
- Marcar pistas que se contradizem e quais vêm de testemunha direta
- Conclusão curta no fim, avaliada por LLM com rubrica
- Transforma "pensar como historiador" em ações pontuáveis

## Confronto entre personagens

Modo em que dois personagens discutem diante de quem joga. Exige orquestração: turnos, quem fala, quando encerra. V1 usa personagens isolados.

## Personagem inventado da rua

Voz comum de Sarajevo (ex.: vendedora sérvia ou bósnia), montada a partir de vários relatos. Marcado como fictício na UI. Cortado da v1 por não ter fonte única para conferir.

## Resumo de conversa longa

No PhiloAgents, "memória longa" é a base de conhecimento (aqui: o corpus) e a curta é o histórico da conversa, sem id de pessoa. Quando passa de 30 mensagens, um LLM menor resume e só as 5 últimas ficam. Aqui falta só esse resumo, dentro do Durable Object. Não exige LangGraph.

Memória entre sessões por pessoa não existe no PhiloAgents; se vier, é ideia nova, não porte.

## Mapa navegável

Phaser, como no PhiloAgents (UI de ~1.650 linhas JS, MIT, sprites do LPC Generator). Custo de código baixo se a fronteira tela ↔ backend do CONTEXT.md for respeitada: o mapa troca a página e fala o mesmo contrato WebSocket. Tempo congelado simplifica: NPCs parados, sem andar sozinhos.

Custos reais:

- **Arte:** tileset de Sarajevo 1914 (Ponte Latina, carro, loja do Schiller), sprites com roupa da época. Assets do PhiloAgents não servem.
- **Celular:** a UI do PhiloAgents só tem teclado; a v1 promete celular. Precisa de controle de toque.
- **Fonte recolhível:** caixa de diálogo do Phaser é ruim para texto longo e fonte. Usar camada HTML por cima do canvas.
- **Albertini:** coro, fora da cena; não tem lugar físico na rua. Sem sprite. Opções:
  - Item na interface (carta ou livro aberto) — simples, mas parece menu, não personagem.
  - Voz que comenta ao se aproximar de pontos do mapa — mais imersivo, mas exige gatilhos por lugar e quebra a regra "só fala quando perguntado".
  - Retrato fixo num canto da tela — meio-termo; ainda é chat, sem andar.
  - Decidir quando o mapa entrar.

## Voz e mais cenas

- Voz: Whisper (STT) + TTS do Workers AI
- Novas cenas: julgamento (out/1914), Princip em Theresienstadt (1916)

## Lojka de volta

Lojka saiu do elenco por falta de relato livre em primeira pessoa. Volta se entrevistas dele dos anos 1920 aparecerem no ANNO (jornais austríacos digitalizados, domínio público). Reavaliado em 2026-10-26 com a regra 1 revista: **fica fora da v1.**

- Achado: relato em primeira pessoa (notas privadas, original alemão, PD) só em trechos citados por Motl, "Řidič vozu smrti", *Reflex*, 25/06/2009 (tcheco), e *profil*, 14/09/2013 (alemão). Sem página, sem original visto, proveniência divergente.
- Volta se o texto for conferido com página em exemplar físico: Skoupý (2017) ou Aichelburg (2014).
- Divergências úteis para o fio "achar viés": Lojka põe a frase dos filhos na boca da duquesa (Harrach, Pharos p. 159: na do arquiduque) e vê os rapazes da bomba à direita.
- Mito para caso `myth`: "Fahren Sie weiter!" da duquesa, em obituários de 07/1926 (*Grazer Volksblatt*, 29/07/1926, p. 4).

## Infra

- Converter este backlog em issues (skill `to-issues`)
