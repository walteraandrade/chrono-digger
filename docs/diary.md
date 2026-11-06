# Diário de investigação

Status: proposta de 2026-11-06. Regras, servidor e tela estão implementados. Falta o eval do diário e o teste com pessoas.

## Problema

Hoje quem abre o jogo só conversa. A tela dá uma missão geral (pensar como historiador), mas nenhuma pergunta, nenhum objetivo e nenhum retorno. Os fios do [eval](fidelity-eval.md) não chegam à tela. O eval mede uma dedução que o jogo nunca pede.

## Ideia

Um diário que se preenche enquanto a pessoa conversa, como um álbum de figurinhas. Cada conversa pode abrir linhas. Algumas lacunas pedem que a pessoa escreva a palavra certa. A entrega é o quanto do diário foi preenchido. Palavras escondidas premiam quem é curioso.

## Decisões

| Decisão | Escolha | Preço |
|---|---|---|
| Tamanho | Um caso só: o sanduíche | Jogo curto, sem a parte mais rica (`rota`) |
| Correção | Determinística, sem IA | Não mede raciocínio livre; pode virar caça-palavras |
| Texto do diário | Escrito por nós, a partir da fonte | Trabalho manual; é preciso rever cada linha |
| Primeiro uso | Testes com poucas pessoas, nos limites atuais | Não prova que funciona numa sala cheia |

## Fora do escopo

- Nota, ranking e painel do professor
- Outros casos, inclusive `rota`
- Conversa com IA sobre a conclusão
- Aumentar os limites de uso

## O caso

**Pergunta na tela:** Princip estava comendo um sanduíche?

| id | Dono | Linha | Respostas aceitas | Gatilho |
|---|---|---|---|---|
| `princip-corner` | Princip | Esperava na [esquina] | esquina | trecho `pharos-1918-princip-16` |
| `princip-shop` | Princip | Estava diante de uma [loja] | loja, armazém, venda | trecho `pharos-1918-princip-16` |
| `harrach-step` | Harrach | Ficou no [estribo] do carro | estribo | trecho `pharos-1918-harrach-01` |
| `harrach-side` | Harrach | Os tiros vieram do lado [oposto] ao dele | oposto, contrário, outro | trecho `pharos-1918-harrach-02` |
| `albertini-none` | Albertini | Não encontrou essa história nas fontes dele | linha sem lacuna | assunto: sanduíche, sandwich, lanche, com plural; comendo |
| `case-verdict` | Caso | Alguma voz confirma o sanduíche? [ninguém] | ninguém, nenhuma, nenhum, não | aberta desde o início |
| `princip-stranger` ★ | Princip | Um homem abordou Princip na esquina: [Pušara] | Pušara, Pusara | palavra dita: Pušara, Pusara |

★ Segredo: a tela não mostra que ele existe antes de abrir. O total só conta segredos já abertos, com um ★ à parte.

As linhas de Princip e Harrach foram conferidas contra Pharos, pp. 30 e 158–159. `albertini-none` não tem trecho que a apoie: o corpus só traz partes de Albertini, então "não encontrou" diz mais do que sabemos.

## Medição

Em 2026-11-06, 6 perguntas em 3 rodadas no OpenRouter (Llama 3.3 70B), sem juiz, com o índice de 47 vetores da branch `feat/albertini-rota-source`. Respostas em `eval/results/diary-*.json`, fora do git.

| Pergunta | Personagem | Trecho esperado | Palavras |
|---|---|---|---|
| Você estava comendo um sanduíche quando o carro parou? | Princip | 3/3 `pharos-1918-princip-16` | "esquina" 3/3; "armazém" 3/3; "loja" 0/3 |
| Onde você estava no carro? | Harrach | 3/3 `pharos-1918-harrach-01` e `-02` | "estribo" 3/3; "oposto" 3/3 |
| De que lado vieram os tiros? | Harrach | 3/3 `pharos-1918-harrach-02` | "oposto" 3/3 |
| O Princip comeu um sanduíche antes de atirar? | Albertini | sem trecho | "sanduíche" 3/3, sem confirmar |
| Alguém falou com você enquanto você esperava na esquina? | Princip | 3/3 `pharos-1918-princip-16` | "Pušara" 3/3 |
| Você conversou com alguém antes de o carro chegar? | Princip | 0/3 `pharos-1918-princip-16` | "Pušara" 0/3; cita o filho do promotor Svara 3/3 |

O que isso mostra:

- **Prompt:** as palavras apareceram sem palavras-chave no prompt. Essa mudança fica fora por enquanto.
- **"Loja":** o modelo disse "armazém" nas 3 rodadas. Sem sinônimos, a lacuna seria injusta.
- **Segredo:** Pušara só aparece quando a pergunta fala da esquina. Isso cria um caminho: a linha da esquina dá a pista para o segredo.
- **Outro segredo possível:** o filho do promotor Svara está em `pharos-1918-princip-15`. A resposta é fiel a esse trecho.
- **Mínimo:** 4 perguntas abrem todas as linhas: uma a Harrach, uma a Albertini e duas a Princip. Cabe no limite de 10.

Limites da medição:

- **Configuração diferente da `main`:** a medição rodou com `MIN_SOURCE_SCORE` 0.4, `temperature` 0.2 e o prompt de `feat/albertini-rota-source`. Na `main`, com 0.45, "Onde você estava no carro?" trouxe só `pharos-1918-harrach-01` numa rodada, e `harrach-side` não abriu. Com 0.4 os dois trechos voltaram. O diário só tem os números medidos em cima dessa configuração.
- É uma redação de pergunta por linha. Outra redação muda o resultado: em `openrouter-3`, "É verdade que você estava comendo um sanduíche quando o carro parou?" não trouxe "esquina" nem "loja".
- As 3 rodadas não são independentes o bastante. Com `temperature` 0.2, várias respostas saíram iguais; `harrach-where` e `princip-secret-a` saíram idênticas nas 3.
- Ninguém real jogou.

### Workers AI, com outras redações

Também em 2026-11-06: 13 redações em 2 rodadas no Workers AI, sem falhas. Respostas em `eval/results/diary-wai-*.json`, fora do git.

| Pergunta | Personagem | Trecho esperado | Palavras |
|---|---|---|---|
| Onde você estava quando o carro parou? | Princip | 2/2 `pharos-1918-princip-16` | "esquina" 2/2; "loja" 2/2 |
| vc tava onde na hora? | Princip | **0/2** | **nenhuma** |
| Você estava comendo um sanduíche quando o carro parou? | Princip | 2/2 | "esquina" 2/2; loja ou sinônimo 0/2 |
| É verdade que você estava comendo um sanduíche? | Princip | 2/2 | "esquina" 2/2; loja ou sinônimo 0/2 |
| Alguém falou com você enquanto você esperava na esquina? | Princip | 2/2 | "Pušara" 2/2 |
| Quem falou com você na esquina? | Princip | 2/2 | "Pušara" 2/2 |
| Você conversou com alguém antes de o carro chegar? | Princip | 0/2 | "Pušara" 0/2; Svara 2/2 |
| Onde você estava no carro? | Harrach | 2/2 ambos | "estribo" 2/2; "oposto" 2/2 |
| Por que você estava do lado de fora do carro? | Harrach | 2/2 ambos | "estribo" 2/2; "oposto" 2/2 |
| De que lado vieram os tiros? | Harrach | 2/2 ambos | "oposto" 2/2 |
| Você viu quem atirou? | Harrach | 2/2 ambos | "estribo" 2/2; "oposto" 2/2 |
| O Princip comeu um sanduíche antes de atirar? | Albertini | sem trecho | não confirma, 2/2 |
| Essa história do sanduíche é verdade? | Albertini | sem trecho | não confirma, 2/2 |

O que isso acrescenta:

- **Pergunta informal falha:** "vc tava onde na hora?" não buscou o trecho e não abriu nada. É o maior risco para este público.
- **Linha pode abrir sem a palavra:** as duas perguntas sobre sanduíche abrem `princip-shop`, mas o modelo não diz a palavra. Isso pode ser bom: a lacuna vazia leva a pessoa a perguntar "onde você estava?". Só o teste com pessoas confirma.
- **Segredo:** falar da esquina trouxe Pušara em 7/7 respostas nas duas medições. Svara só apareceu na pergunta sobre conversar antes do carro chegar.
- **Harrach é estável demais para provar muito:** ele só tem 2 trechos, e os 2 voltaram nas 4 perguntas. É provável que quase qualquer pergunta sobre a cena abra as linhas dele. Não testei perguntas fora do assunto.
- **Mesmo modelo:** os dois provedores usam Llama 3.3 70B, então concordar entre eles não é uma segunda opinião.

Defeitos vistos nas respostas, fora do diário:

- **Tempo confuso:** Princip diz que está esperando o carro e que acabou de atirar na mesma resposta. O congelamento é depois dos tiros.
- **Lugar sem fonte:** nas duas rodadas de "Você estava comendo um sanduíche...", Princip disse "perto de um cais" em vez de "diante de uma loja".
- **Palavra quebrada:** "passageos" apareceu em respostas de Albertini, nos dois provedores. Parece vir de "passages" no prompt.

## Gatilhos

Rodam só depois de um turno bem-sucedido. Um turno que falhou não abre nada.

| Gatilho | Dispara quando | Usado para |
|---|---|---|
| `chunk` | O servidor buscou o trecho X para aquele personagem | Linhas comuns |
| `askedAbout` | A pergunta da pessoa, para aquele personagem, contém um dos termos | Fatos sem trecho, como a ausência do sanduíche |
| `saidWord` | A resposta do personagem contém um dos termos | Segredos |

Por que três:

- **`chunk` é o mais estável.** A mesma pergunta buscou o mesmo trecho principal nas rodadas `openrouter-3` e `openrouter-4`, mas o texto da resposta mudou.
- **`chunk` não esconde nada.** Pušara está em `pharos-1918-princip-16`, o mesmo trecho da esquina. Um segredo com gatilho `chunk` abriria sozinho.
- **`askedAbout` cobre o que não tem trecho.** Nenhum trecho do corpus fala de sanduíche.

A comparação ignora maiúsculas, acentos e pontuação e olha palavras inteiras: "lanche" não casa com "lanchonete". Termos com várias palavras precisam aparecer inteiros e em ordem. Cada gatilho só vale para o dono da linha.

## Correção

- A pessoa escreve a palavra na lacuna. O servidor normaliza e compara com as respostas aceitas.
- Preencher uma lacuna não gasta pergunta do limite diário.
- Pode tentar quantas vezes quiser. Errar não custa nada.
- Uma lacuna aberta aceita a palavra mesmo se o personagem não a disse.
- Depois do acerto, a linha mostra a palavra dela, não o sinônimo digitado. Quem escreve "armazém" lê "Estava diante de uma loja".

## Onde fica cada coisa

- **Conteúdo do caso:** `src/diary/cases.ts`, só no servidor. As respostas nunca vão para `public/`.
- **Regras:** funções puras em `src/diary/rules.ts`: `matchTriggers` e `checkAnswer`. Sem rede, sem armazenamento. Os gatilhos são dados, no estilo Strategy.
- **Progresso:** um Durable Object novo, `PlayerDiary`, um por `playerId`. `CharacterSession` chama esse objeto depois de cada turno.

Por que um objeto por pessoa, e não guardar em cada `CharacterSession`:

| Opção | Vantagem | Preço |
|---|---|---|
| `PlayerDiary` (escolhida) | Um lugar só para o progresso; `case-verdict` não pertence a nenhum personagem | Uma classe e uma migração a mais |
| Tabela em cada `CharacterSession` | Sem classe nova | A tela soma os pedaços, e `case-verdict` fica sem dono |

## Contrato WebSocket

Está em [ws-contract.md](ws-contract.md). As mensagens novas são `diary`, `fillResult` e `fill`, mais o erro `diary_failure`.

## Perguntas sugeridas

Botões acima do campo de pergunta. Clicar envia a pergunta como se a pessoa a tivesse digitado, e ela gasta uma pergunta do limite.

| Personagem | Pergunta | Abre |
|---|---|---|
| Princip | Onde você estava quando o carro parou? | `princip-corner`, `princip-shop` |
| Harrach | Onde você estava no carro? | `harrach-step`, `harrach-side` |
| Albertini | Essa história do sanduíche é verdade? | `albertini-none` |

Regras:

- Usar só perguntas já medidas. Toda sugestão nova entra no eval do diário.
- Nunca sugerir caminho de segredo. Nada de sugestão que fale da esquina ou de conversa com alguém.
- A sugestão some depois de usada. A tela decide isso olhando o histórico da conversa, então o servidor não guarda nada a mais, e uma pergunta que falhou continua sugerida.
- Texto e personagem vão na mensagem `diary`. As respostas aceitas, não.

Com essas 3 perguntas, a pessoa abre todas as linhas comuns e pode preencher o caso. O segredo fica para quem seguir a pista da esquina. Preço: dá para terminar as linhas comuns só clicando, e digitar segue sendo opcional. O teste com pessoas mostra se isso esvazia a investigação.

## Tela

- A pergunta do caso fica visível na lista de personagens e no chat.
- O diário é um painel aberto ao lado do chat; no celular, uma aba.
- Linha nova e acerto recebem um destaque curto. Nada de som.
- Diário completo mostra o que as fontes dizem, com autor e página.

## Evals

**Eval do diário (novo).** Um script faz perguntas prontas e confere, sem IA:

- Cada linha abriu? Cada palavra aceita apareceu na resposta?
- Quantas perguntas foram gastas?

Meta inicial, a rever depois de medir:

- 100% das linhas comuns abrem
- Palavras aparecem em pelo menos 90% das respostas, em 3 rodadas
- Diário completo com no máximo 6 perguntas

**Eval de fidelidade (atual).** Continua como proteção contra invenção. A meta de 90% deixa de ser o critério para testar com pessoas. O critério passa a ser zero invenção nos casos do fio `sanduiche`, que hoje também precisam passar por um juiz.

## Riscos

| Risco | Evidência | O que fazer |
|---|---|---|
| O modelo não diz a palavra | Depende da redação: ver Medição | Aceitar sinônimos. Testar com várias redações. Se ficar abaixo da meta, passar as palavras-chave do trecho buscado ao prompt |
| Palavra-chave no prompt soa falsa ou entrega segredo | Não testado | Medir, se for preciso usar. Segredos nunca entram na lista |
| O segredo fica difícil demais | Uma pergunta abriu 3/3 e outra 0/3 | Dar a pista na linha da esquina |
| Pergunta informal não abre nada | "vc tava onde na hora?" falhou 2/2 | Perguntas sugeridas reduzem o risco, mas quem digitar do próprio jeito ainda pode cair nisso |
| Vira caça-palavras | Hipótese | Observar pessoas jogando |
| Caso curto demais | São só 7 linhas | Decidir depois do teste; o próximo caso seria `tiro-bomba` |
| Limite de 10 perguntas frustra | Cada tentativa de segredo gasta uma pergunta | Manter o diário bem abaixo do limite |

## Ordem de trabalho

1. **Medir:** feito (ver Medição). Falta só testar perguntas fora do assunto, junto do eval do diário.
2. **Regras:** feito (`src/diary/`, testes em `test/diary/`).
3. **Servidor:** feito (`src/diary/player-diary.ts`, testes em `test/seam/diary.test.ts`). Testado só com provedores falsos.
4. **Tela:** feito (`public/`). Testada no navegador com o modelo real, em desktop e em 375 px de largura.
5. **Eval do diário:** script e metas.
6. **Teste com pessoas:** 3 a 5 pessoas, olhando se elas entendem o objetivo.

## Perguntas em aberto

- O que `albertini-none` pode afirmar? Ele morreu em 1941, e a menção mais antiga achada ao sanduíche é de 1998 ([CONTEXT.md](../CONTEXT.md)).
- `case-verdict` abre desde o início e aceita "não". Dá para acertar sem conversar com ninguém. Isso é aceitável?
- Escrever a palavra basta para a pessoa comparar versões? Só o teste com pessoas responde.
- O que a pessoa recebe ao completar o diário, além das fontes?
- A referência a Mike Dash (2011) no texto final não tem título nem página. Falta completar.
- A linha da esquina não dá pista nenhuma do segredo. Basta a palavra "esquina" para alguém perguntar mais? Só o teste com pessoas responde.
