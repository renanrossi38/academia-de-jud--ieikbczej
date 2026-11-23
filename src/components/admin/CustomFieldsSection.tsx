import React from 'react'
import { CustomField } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowDown, ArrowUp, Plus, Trash2, Wand2 } from 'lucide-react'

type FieldType = CustomField['type']

const TYPE_OPTIONS: { label: string; value: FieldType }[] = [
  { label: 'Texto curto', value: 'texto' },
  { label: 'Número', value: 'numero' },
  { label: 'Escolha', value: 'escolha' },
]

/** Atalho: modelo "Kimono sob medida" pronto para inserir com um clique e ajustar. */
const KIMONO_TEMPLATE: CustomField[] = [
  { name: 'Peso', type: 'numero', required: true, options: [] },
  { name: 'Estatura', type: 'numero', required: true, options: [] },
  { name: 'Cor', type: 'escolha', required: true, options: ['Branco', 'Azul'] },
  {
    name: 'Modelo',
    type: 'escolha',
    required: true,
    options: ['Trançado leve', 'Trançado pesado', 'Trançado especial'],
  },
]

const selectClass =
  'h-9 text-xs rounded-md border border-[#E8E0D5] bg-white px-2 text-[#1C1B1A] focus:outline-hidden focus:ring-1 focus:ring-[#C1272D]'

interface CustomFieldsSectionProps {
  /** Campos salvos no produto; null/vazio = produto comum (sem sob medida). */
  fields: CustomField[] | null
  /** Devolve a lista completa (null quando fica vazia = produto comum). */
  onChange: (fields: CustomField[]) => void
}

/**
 * Seção "Produto sob medida" do editor de produto: permite definir campos
 * personalizados (nome, tipo, opções de escolha, obrigatório, ordem) gravados
 * em products.custom_options e preenchidos pelo comprador no checkout.
 */
export const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({ fields, onChange }) => {
  const list = fields ?? []
  const isCustom = list.length > 0

  const update = (index: number, patch: Partial<CustomField>) => {
    onChange(list.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  const addField = () => {
    onChange([...list, { name: '', type: 'texto', required: true, options: [] }])
  }

  const removeField = (index: number) => {
    onChange(list.filter((_, i) => i !== index))
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= list.length) return
    const next = [...list]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-2 rounded-xl border border-[#E8E0D5] bg-[#FAF6F0]/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#1C1B1A]">Produto sob medida</p>
          <p className="text-[11px] text-[#6B6560]">
            Campos que o comprador preenche ao comprar (ex.: kimono feito sob medida).
          </p>
        </div>
        {!isCustom && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange(KIMONO_TEMPLATE.map((f) => ({ ...f, options: [...f.options] })))
            }
            className="shrink-0 h-8 border-[#C1272D]/40 text-[#C1272D] text-[11px] font-semibold"
            title="Inserir Peso, Estatura, Cor e Modelo de uma vez"
          >
            <Wand2 className="w-3.5 h-3.5 mr-1" />
            Kimono sob medida
          </Button>
        )}
      </div>

      {isCustom && (
        <div className="space-y-2">
          {list.map((field, index) => (
            <div
              key={index}
              className="rounded-lg border border-[#E8E0D5] bg-white p-2.5 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={field.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                  placeholder="Nome do campo (ex.: Peso)"
                  className="h-8 flex-1 text-xs bg-white border-[#E8E0D5]"
                  maxLength={60}
                  aria-label={`Nome do campo ${index + 1}`}
                />
                <select
                  value={field.type}
                  onChange={(e) =>
                    update(index, {
                      type: e.target.value as FieldType,
                      ...(e.target.value !== 'escolha' ? { options: [] } : {}),
                    })
                  }
                  className={selectClass}
                  aria-label={`Tipo do campo ${index + 1}`}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {field.type === 'escolha' && (
                <div className="space-y-1">
                  <Input
                    value={field.options.join(', ')}
                    onChange={(e) =>
                      update(index, {
                        options: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Opções separadas por vírgula (ex.: Branco, Azul)"
                    className="h-8 text-xs bg-white border-[#E8E0D5]"
                    aria-label={`Opções do campo ${index + 1}`}
                  />
                  <p className="text-[10px] text-[#6B6560]">
                    Separe as opções por vírgula. Aparecem como seleção para o comprador.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1C1B1A]">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => update(index, { required: e.target.checked })}
                    className="w-3.5 h-3.5 accent-[#C1272D]"
                  />
                  Obrigatório
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="h-7 px-1.5 border-[#E8E0D5] text-[#6B6560]"
                    title="Subir campo"
                    aria-label={`Subir campo ${index + 1}`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => move(index, 1)}
                    disabled={index === list.length - 1}
                    className="h-7 px-1.5 border-[#E8E0D5] text-[#6B6560]"
                    title="Descer campo"
                    aria-label={`Descer campo ${index + 1}`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeField(index)}
                    className="h-7 px-1.5 border-[#E8E0D5] text-[#B3261E]"
                    title="Remover campo"
                    aria-label={`Remover campo ${index + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addField}
            className="w-full h-8 border-dashed border-[#C1272D]/40 text-[#C1272D] text-[11px] font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Adicionar campo
          </Button>
        </div>
      )}

      {!isCustom && (
        <Label className="block text-[10px] text-[#6B6560] font-normal">
          Produto comum — o comprador escolhe apenas tamanho/estoque. Use o atalho acima para um
          kimono sob medida ou adicione campos depois de criar o primeiro.
        </Label>
      )}
    </div>
  )
}
