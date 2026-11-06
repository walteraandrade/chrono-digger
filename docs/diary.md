# Diário de investigação

Status: proposta de 2026-11-06. Nada implementado.

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
| `albertini-none` | Albertini | Não encontrou essa história nas fontes dele | linha sem lacuna | assunto: sanduíche, sandwich, lanche, comendo |
| `case-verdict` | Caso | Alguma voz confirma o sanduíche? [ninguém] | ninguém, nenhuma, nenhum, não | aberta desde o início |
| `princip-stranger` ★ | Princip | Um homem abordou Princip na esquina: [Pušara] | Pušara, Pusara | palavra dita: Pušara, Pusara |

★ Segredo: a tela não mostra que ele existe antes de abrir. O total só conta segredos já abertos, com um ★ à parte.

Esta tabela é um rascunho. Falta rever cada linha contra a fonte.

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

A comparação ignora maiúsculas e acentos. Termos com várias palavras precisam aparecer inteiros e em ordem.

## Correção

- A pessoa escreve a palavra na lacuna. O servidor normaliza e compara com as respostas aceitas.
- Preencher uma lacuna não gasta pergunta do limite diário.
- Pode tentar quantas vezes quiser. Errar não custa nada.
- Uma lacuna aberta aceita a palavra mesmo se o personagem não a disse.

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

Entra em [ws-contract.md](ws-contract.md) na implementação.

```ts
type DiaryLine = {
  id: string;
  owner: string;
  text: string;
  blank?: { filled: boolean; word?: string };
  secret: boolean;
};

type ServerMessage =
  | /* existing messages */
  | { type: "diary"; caseQuestion: string; lines: DiaryLine[]; filled: number; total: number; secretsOpen: number }
  | { type: "fillResult"; lineId: string; correct: boolean };

type ClientMessage =
  | { type: "ask"; text: string }
  | { type: "fill"; lineId: string; word: string };
```

- `diary` chega ao conectar e sempre que algo mudar.
- Linha fechada não é enviada. `word` só é enviada depois do acerto. `text` traz a lacuna em branco.
- `fill` em linha fechada ou inexistente devolve `bad_request`.

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
| Pergunta informal não abre nada | "vc tava onde na hora?" falhou 2/2 | Decidir antes de testar com pessoas: ver Perguntas em aberto |
| Vira caça-palavras | Hipótese | Observar pessoas jogando |
| Caso curto demais | São só 7 linhas | Decidir depois do teste; o próximo caso seria `tiro-bomba` |
| Limite de 10 perguntas frustra | Cada tentativa de segredo gasta uma pergunta | Manter o diário bem abaixo do limite |

## Ordem de trabalho

1. **Medir:** feito (ver Medição). Falta só testar perguntas fora do assunto, junto do eval do diário.
2. **Regras:** `src/diary/` com testes.
3. **Servidor:** `PlayerDiary` e contrato.
4. **Tela:** painel do diário.
5. **Eval do diário:** script e metas.
6. **Teste com pessoas:** 3 a 5 pessoas, olhando se elas entendem o objetivo.

## Perguntas em aberto

- As linhas do caso estão certas contra a fonte?
- Como lidar com pergunta informal? Perguntas sugeridas na tela resolvem, mas dão o caminho pronto. Reescrever a pergunta antes da busca mantém a liberdade, mas gasta mais cota e adiciona uma chamada de IA.
- Escrever a palavra basta para a pessoa comparar versões? Só o teste com pessoas responde.
- O que a pessoa recebe ao completar o diário, além das fontes?
