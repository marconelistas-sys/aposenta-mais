# ADR 0001: motor financeiro determinístico

Status: aceito

## Contexto

O produto precisa apresentar cálculos reproduzíveis e explicar as premissas usadas em cada projeção.

## Decisão

O módulo `src/domain/retirement.js` será a única fonte dos números oficiais do MVP. Recursos de inteligência artificial poderão explicar resultados calculados, mas não substituir o motor.

## Consequências

- Mesmas entradas produzem os mesmos resultados.
- Fórmulas podem ser validadas por testes de referência.
- Alterações financeiras exigem testes e revisão especializada.
- Explicações futuras devem validar seus números contra a saída do motor.

