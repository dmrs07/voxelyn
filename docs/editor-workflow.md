# Voxelforge Editor Workflow

## Menu no Desktop

- No desktop (Electron), o menubar oficial e o nativo (`File/Edit/View/Window/Help`).
- A UI interna do editor atua como toolbar/painel, sem duplicar menubar textual.
- No modo web (Vite), o menubar interno continua disponivel para navegacao local.

## Abrir Projeto

1. No Electron, use `File -> Open Project Folder...`.
2. Se a pasta for um projeto Voxelyn valido, o editor atualiza automaticamente.
3. O renderer acessa somente arquivos dentro da pasta aberta.

Um projeto criado via CLI inclui `voxelyn.project.json` e estrutura base:

- `assets/`
- `assets/generated/`
- `scenes/`
- `worlds/`
- `build/maps/`

## Project Browser

No painel `Project`:

- `Open Project`: abre seletor de pasta.
- `Refresh`: reindexa assets/cenarios/saidas de IA.
- `Scenes/Cenarios`: lista arquivos de cena.
- `Assets`: lista arquivos de asset.

Entradas podem ser:

- clicadas para adicionar no mundo na origem;
- arrastadas para o viewport para posicionamento por drop.

## Compor Mundo

Formato salvo em `worlds/default.world.json`.

Fluxo:

1. Ative `Composer mode`.
2. Arraste assets/cenarios para o viewport.
3. Ajuste snap (`Snap`, `Step`, `Rot`).
4. Selecione itens e edite `Position/Rotation/Scale`.
5. Salve com `Save World` (autosave tambem ocorre em alteracoes).

Undo/redo do compositor:

- `Ctrl+Z` / `Ctrl+Y` quando `Composer mode` estiver ativo.

## Transformacoes por Modo

- `3d`: movimentacao livre no plano e rotacao por eixos no painel.
- `iso`: movimentacao no plano principal (altura por painel numerico).
- `2d`: movimentacao no plano XY e altura bloqueada (Z); rotacao yaw apenas.

## Hero/Test

No painel `Project`:

1. Selecione um item e clique em `Mark Hero` (opcional).
2. Clique em `Set Spawn (Click Viewport)` e escolha o spawn.
3. Clique em `Play/Test`.
4. Use `WASD` (ou setas no 2D).
5. Clique em `Stop` para voltar ao modo de edicao.

Colisao:

- modo padrao: `AABB`;
- pode ser desligada no world file (`hero.collision = "off"`).

## Generate Map

No menu de status `Build -> Generate Map` ou no painel `Project`:

- le `worlds/default.world.json`;
- valida `sourceRef` de cada item;
- grava `build/maps/default.map.json`;
- inclui `errors` no artefato quando refs nao existem.

## Smoke Checklist

1. Abrir pasta de projeto criada com `voxelyn create`.
2. Ver listas de `Scenes/Cenarios` e `Assets` no painel `Project`.
3. Arrastar dois itens para o viewport e salvar.
4. Fechar/reabrir projeto e confirmar persistencia em `worlds/default.world.json`.
5. Marcar heroi, definir spawn, iniciar `Play/Test` e mover.
6. Rodar `Generate Map` e validar `build/maps/default.map.json`.
