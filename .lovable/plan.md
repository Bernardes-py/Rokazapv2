

## Correção: dupla inversão de datas no frontend

O backend já converte para DD/MM/YYYY (`toddmmyyyy`), mas o `formatVencimento` no `BoletoComposer.tsx` **re-inverte** a data de volta para MM/DD/YYYY.

### Correção em `src/components/chat/BoletoComposer.tsx`

Simplificar `formatVencimento` para apenas extrair a parte da data sem inverter:

```typescript
const formatVencimento = (raw: string): string => {
  return (raw || '').split(' ')[0];
};
```

Isso afeta as linhas ~95-107 do arquivo.

