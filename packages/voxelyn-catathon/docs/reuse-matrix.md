# Catathon — matriz de reuso do monorepo

Auditoria feita lendo codigo e testes dos pacotes (nao os READMEs).

| Pacote | Uso no slice | Como |
| --- | --- | --- |
| `voxelyn-core` | **Direto** | `Surface2D`/`createSurface2D`, `packRGBA`, `adjustBrightness`, `projectIso` (o chao do pavilhao e projetado com a MESMA formula dos irmaos), adapter `presentToCanvas`. |
| `voxelyn-survival-sim` | **Referencia** | O padrao — ticks inteiros, comandos quantizados, hash FNV-1a, eventos drenados por tick — e adotado; nenhuma regra de survival e importada. |
| `voxelyn-survival-content` | **Referencia** | A disciplina de pipeline de arte (paleta fechada, assets gerados). O slice usa sprites procedurais em codigo; um atlas assado e passo natural depois. |
| `voxelyn-animation` | **Referencia** | O modelo de clipe (frames/fps/loop) informa os ciclos dos gatos; os arquetipos prontos sao guerreiros sci-fi, inuteis para felinos. |
| `voxelyn-roguelike` | **Referencia** | Geracao semeada de eventos/estrutura de run — o jitter semeado das bolas de pelo segue o mesmo espirito. |
| `voxelyn-ai` | **Fora (slice)** | Utility-AI generica para 4 gatos com 6 modos seria andaime; a maquina de estados local tem ~200 linhas e e testavel. Reavaliar com 20+ gatos. |
| `voxelyn-survival-server` / `-protocol` | **Fora (por ora)** | Padroes para co-op autoritativo futuro. A sim ja e determinista de proposito. |
| `voxelyn-atlas-studio` / `voxelforge-*` | **Fora (slice)** | Ferramentas de autoria; entram quando os gatos ganharem atlas assado. |

**Audio do Survival** (3.8k linhas): **referencia estrutural**. Os assentos do
audio daqui (transport/mixer/voices/grafo adaptativo/ducking/preferencias)
espelham os de la de proposito, e `docs/audio.md` explica por que a extracao de
um `voxelyn-audio` compartilhado espera um segundo consumidor.

**RNG**: xorshift32 identico ao `voxelyn-core`, reescrito como funcao pura
sobre estado serializado — a classe do core guarda estado privado, e um hash
autoritativo precisa misturar o estado do gerador (mesma razao do `Stream` da
Iliada).
