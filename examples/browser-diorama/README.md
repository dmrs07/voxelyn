# Voxelyn - Diorama de Natureza

Um sandbox interativo de simulação de materiais com física de partículas.

## Features

- **Simulação de Materiais**: Areia, água, fogo, lava, neve, fumaça, vapor
- **Interações Físicas**: Materiais reagem entre si (água apaga fogo, lava derrete gelo, etc.)
- **Personagem Jogável**: Movimentação com física de plataforma
- **Sistema de Flechas**: Atire flechas que interagem com o mundo
- **Terreno Gerado**: Montanhas, lago, árvores, neve

## Controles

| Ação | Tecla |
|------|-------|
| Mover | WASD ou Setas |
| Pular | Espaço ou W |
| Atirar flecha | Clique esquerdo ou F |
| Pintar material | Shift + Clique esquerdo |
| Apagar | Clique direito (segurar) |
| Selecionar material | 1-9, 0 |

## Materiais

1. **Areia** - Cai e forma pilhas
2. **Água** - Flui e se espalha, apaga fogo
3. **Pedra** - Sólido, não se move
4. **Terra** - Cai como areia
5. **Fogo** - Queima madeira/folhas, produz fumaça
6. **Lava** - Derrete gelo, incendeia materiais
7. **Neve** - Cai lentamente, derrete com calor
8. **Madeira** - Sólido, queima com fogo
9. **Folha** - Cai se não tiver suporte, queima

## Interações

- Fogo + Água → Vapor
- Lava + Água → Vapor + Pedra
- Fogo/Lava + Gelo/Neve → Água
- Flecha + Madeira → Fogo (chance)
- Flecha + Folha/Grama → Destrói
