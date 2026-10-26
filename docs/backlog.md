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

## Memória entre sessões

Resumo e memória longa por pessoa, como no PhiloAgents. Provavelmente exige reescrever o fluxo (avaliar LangGraph.js).

## Mapa, voz e mais cenas

- Mapa navegável (Phaser, como no PhiloAgents)
- Voz: Whisper (STT) + TTS do Workers AI
- Novas cenas: julgamento (out/1914), Princip em Theresienstadt (1916)

## Lojka de volta

Lojka saiu do elenco por falta de relato livre em primeira pessoa. Volta se entrevistas dele dos anos 1920 aparecerem no ANNO (jornais austríacos digitalizados, domínio público).

## Infra

- Converter este backlog em issues (skill `to-issues`)
