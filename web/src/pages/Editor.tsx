import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, api, shareUrl } from '../lib/api'
import { exportCardAsPng } from '../lib/export'
import { ATTRIBUTES, MONSTER_KINDS, RACES, SPELL_KINDS, TRAP_KINDS } from '../lib/labels'
import type { CardDraft, CardKind, CardRecord } from '../types'
import { KindIcon } from '../components/AttributeIcon'
import { CardScaler } from '../components/CardScaler'
import { YgoCard } from '../components/YgoCard'
import { Chips, Field, Section, Stars, Stepper, Toast, Toggle, type ToastMessage } from '../components/ui'

const DEFAULT_DRAFT: CardDraft = {
  name: '',
  kind: 'monster',
  description: '',
  monster_kind: 'effect',
  spell_kind: null,
  trap_kind: null,
  attribute: 'dark',
  race: 'Mago',
  archetype: '',
  level: 8,
  atk: 2500,
  defense: 2000,
  image_url: null,
  image_path: null,
  holo: true,
  is_public: true,
}

const MAX_DESCRIPTION = 800

function toDraft(card: CardRecord): CardDraft {
  return {
    name: card.name,
    kind: card.kind,
    description: card.description,
    monster_kind: card.monster_kind,
    spell_kind: card.spell_kind,
    trap_kind: card.trap_kind,
    attribute: card.attribute,
    race: card.race ?? '',
    archetype: card.archetype ?? '',
    level: card.level,
    atk: card.atk,
    defense: card.defense,
    image_url: card.image_url,
    image_path: card.image_path,
    holo: card.holo,
    is_public: card.is_public,
  }
}

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const remix = searchParams.get('remix')
  const navigate = useNavigate()

  const [draft, setDraft] = useState<CardDraft>({ ...DEFAULT_DRAFT })
  const [saved, setSaved] = useState<CardRecord | null>(null)
  const [loading, setLoading] = useState(Boolean(id || remix))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!id && !remix) return
      setLoading(true)
      try {
        const card = id ? await api.get(id) : await api.getBySlug(remix as string)
        if (!active) return
        setDraft(toDraft(card))
        setSaved(id ? card : null)
      } catch (error) {
        if (!active) return
        setToast({ kind: 'error', title: 'Carta não encontrada', message: (error as Error).message })
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [id, remix])

  const update = useCallback((patch: Partial<CardDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }))
  }, [])

  function changeKind(kind: CardKind) {
    setDraft((previous) => {
      if (kind === previous.kind) return previous
      if (kind === 'monster') {
        return {
          ...previous,
          kind,
          monster_kind: 'effect',
          attribute: previous.attribute ?? 'dark',
          race: previous.race || 'Mago',
          level: 8,
          atk: 2500,
          defense: 2000,
          spell_kind: null,
          trap_kind: null,
        }
      }
      const base = {
        ...previous,
        kind,
        monster_kind: null,
        attribute: null,
        race: null,
        level: null,
        atk: null,
        defense: null,
        spell_kind: kind === 'spell' ? ('normal' as const) : null,
        trap_kind: kind === 'trap' ? ('normal' as const) : null,
      }
      return base
    })
  }

  function changeMonsterKind(value: string) {
    const max = value === 'link' ? 8 : value === 'xyz' ? 13 : 12
    setDraft((previous) => {
      const nextLevel = Math.min(previous.level ?? 8, max)
      const nextDefense = value === 'link' ? null : (previous.defense ?? 2000)
      return {
        ...previous,
        monster_kind: value as CardDraft['monster_kind'],
        level: nextLevel,
        defense: nextDefense,
      }
    })
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setToast({ kind: 'error', title: 'Arquivo inválido', message: 'Envie uma imagem PNG, JPEG ou WebP.' })
      return
    }
    if (file.size > 6 * 1024 * 1024) {
      setToast({ kind: 'error', title: 'Imagem grande demais', message: 'O limite é 6 MB.' })
      return
    }
    setUploading(true)
    try {
      const uploaded = await api.uploadImage(file)
      update({ image_url: uploaded.url, image_path: uploaded.path })
      setToast({ kind: 'ok', title: 'Arte enviada', message: `${uploaded.width}×${uploaded.height}px` })
    } catch (error) {
      setToast({ kind: 'error', title: 'Falha no upload', message: (error as Error).message })
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      setToast({ kind: 'error', title: 'Falta o nome', message: 'Dê um nome à sua carta.' })
      return
    }
    if (draft.description.length > MAX_DESCRIPTION) {
      setToast({ kind: 'error', title: 'Texto longo', message: 'A descrição passa de 800 caracteres.' })
      return
    }

    setSaving(true)
    try {
      const payload: CardDraft = { ...draft, name: draft.name.trim() }
      const record = saved ? await api.update(saved.id, payload) : await api.create(payload)
      setSaved(record)
      setDraft(toDraft(record))
      setToast({
        kind: 'ok',
        title: saved ? 'Carta atualizada' : 'Carta criada',
        message: 'O link público já está pronto para compartilhar.',
      })
      if (!id) navigate(`/editar/${record.id}`, { replace: true })
    } catch (error) {
      const message =
        error instanceof ApiError && Array.isArray(error.details) && error.details.length > 0
          ? String((error.details[0] as { msg?: string }).msg ?? error.message)
          : (error as Error).message
      setToast({ kind: 'error', title: 'Não foi possível salvar', message })
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    const node = exportRef.current?.querySelector('.ygo-card')
    if (!(node instanceof HTMLElement)) return
    setExporting(true)
    try {
      await exportCardAsPng(node, draft.name || 'carta')
      setToast({ kind: 'ok', title: 'PNG gerado', message: 'Arquivo salvo em 840×1224 px.' })
    } catch (error) {
      setToast({
        kind: 'error',
        title: 'Falha ao exportar',
        message: `Tente novamente. ${(error as Error).message}`,
      })
    } finally {
      setExporting(false)
    }
  }

  async function handleCopyLink() {
    if (!saved) {
      setToast({ kind: 'error', title: 'Salve primeiro', message: 'O link só existe depois de salvar a carta.' })
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl(saved.slug))
      setToast({ kind: 'ok', title: 'Link copiado', message: shareUrl(saved.slug) })
    } catch {
      setToast({ kind: 'error', title: 'Não foi possível copiar', message: shareUrl(saved.slug) })
    }
  }

  function reset() {
    setSaved(null)
    setDraft({ ...DEFAULT_DRAFT })
    navigate('/criar')
    setToast({ kind: 'ok', title: 'Nova carta', message: 'Formulário limpo.' })
  }

  const isMonster = draft.kind === 'monster'
  const maxLevel = draft.monster_kind === 'link' ? 8 : draft.monster_kind === 'xyz' ? 13 : 12
  const levelLabel =
    draft.monster_kind === 'link' ? 'Link Rating' : draft.monster_kind === 'xyz' ? 'Rank' : 'Nível'

  return (
    <div className="shell page">
      <div className="row" style={{ marginBottom: 26 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            {saved ? 'Editando carta' : 'Nova carta'}
          </p>
          <h1 className="display" style={{ fontSize: 'clamp(26px, 3.4vw, 38px)' }}>
            {draft.name.trim() || 'Carta sem nome'}
          </h1>
        </div>
        <div className="spacer" />
        {saved && (
          <div className="row">
            <a className="btn btn--small" href={`/c/${saved.slug}`} target="_blank" rel="noreferrer">
              Ver pública
            </a>
            <button type="button" className="btn btn--small" onClick={reset}>
              Nova carta
            </button>
          </div>
        )}
      </div>

      <div className="editor">
        <div className="stack">
          <Section step="01" title="Tipo da carta">
            <div className="segmented" role="tablist" aria-label="Tipo da carta">
              <button
                type="button"
                className={draft.kind === 'monster' ? 'active' : ''}
                onClick={() => changeKind('monster')}
              >
                <KindIcon kind="monster" />
                Monstro
              </button>
              <button
                type="button"
                className={draft.kind === 'spell' ? 'active' : ''}
                onClick={() => changeKind('spell')}
              >
                <KindIcon kind="spell" />
                Magia
              </button>
              <button
                type="button"
                className={draft.kind === 'trap' ? 'active' : ''}
                onClick={() => changeKind('trap')}
              >
                <KindIcon kind="trap" />
                Armadilha
              </button>
            </div>

            <div className="field" style={{ marginTop: 18 }}>
              <span className="field__label">
                <span>{isMonster ? 'Categoria do monstro' : draft.kind === 'spell' ? 'Tipo de magia' : 'Tipo de armadilha'}</span>
              </span>
              {isMonster ? (
                <Chips
                  options={MONSTER_KINDS.map((option) => ({ value: option.value, label: option.label }))}
                  value={draft.monster_kind}
                  onChange={changeMonsterKind}
                />
              ) : draft.kind === 'spell' ? (
                <Chips
                  options={SPELL_KINDS.map((option) => ({ value: option.value, label: option.label }))}
                  value={draft.spell_kind}
                  onChange={(value) => update({ spell_kind: value as CardDraft['spell_kind'] })}
                />
              ) : (
                <Chips
                  options={TRAP_KINDS.map((option) => ({ value: option.value, label: option.label }))}
                  value={draft.trap_kind}
                  onChange={(value) => update({ trap_kind: value as CardDraft['trap_kind'] })}
                />
              )}
            </div>

            {isMonster && (
              <div className="field">
                <span className="field__label">
                  <span>Atributo</span>
                  <span className="field__hint">define a cor da moldura</span>
                </span>
                <Chips
                  options={ATTRIBUTES.map((attribute) => ({
                    value: attribute.value,
                    label: attribute.label,
                    color: attribute.color,
                  }))}
                  value={draft.attribute}
                  onChange={(value) => update({ attribute: value as CardDraft['attribute'] })}
                />
              </div>
            )}
          </Section>

          <Section step="02" title="Identidade">
            <Field label="Nome da carta" hint={`${draft.name.length}/60`}>
              <input
                className="input"
                value={draft.name}
                maxLength={60}
                placeholder="Ex.: Julia, Dama de Köln"
                onChange={(event) => update({ name: event.target.value })}
              />
            </Field>

            <div className="input-row">
              <Field label="Arquétipo" hint="opcional">
                <input
                  className="input"
                  value={draft.archetype ?? ''}
                  maxLength={40}
                  placeholder='Ex.: "Guardiões de Köln"'
                  onChange={(event) => update({ archetype: event.target.value })}
                />
              </Field>

              {isMonster && (
                <Field label="Raça / Tipo" hint="opcional">
                  <input
                    className="input"
                    list="ygo-races"
                    value={draft.race ?? ''}
                    maxLength={32}
                    placeholder="Ex.: Mago"
                    onChange={(event) => update({ race: event.target.value })}
                  />
                  <datalist id="ygo-races">
                    {RACES.map((race) => (
                      <option key={race} value={race} />
                    ))}
                  </datalist>
                </Field>
              )}
            </div>
          </Section>

          {isMonster && (
            <Section step="03" title={levelLabel}>
              <div className="field">
                <span className="field__label">
                  <span>{levelLabel}</span>
                  <span className="field__hint">clique nas estrelas · máx. {maxLevel}</span>
                </span>
                <Stars
                  value={draft.level}
                  max={maxLevel}
                  onChange={(value) => update({ level: value })}
                />
              </div>

              <div className="input-row" style={{ marginTop: 4 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <span className="field__label">
                    <span>ATK</span>
                  </span>
                  <Stepper value={draft.atk} onChange={(value) => update({ atk: value })} />
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <span className="field__label">
                    <span>DEF</span>
                  </span>
                  {draft.monster_kind === 'link' ? (
                    <span className="field__hint">Monstros de Link não possuem DEF.</span>
                  ) : (
                    <Stepper value={draft.defense} onChange={(value) => update({ defense: value })} />
                  )}
                </div>
              </div>
            </Section>
          )}

          <Section step={isMonster ? '04' : '03'} title="Arte da carta">
            <div
              className={`dropzone${dragging ? ' dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void handleFile(event.dataTransfer.files[0])
              }}
            >
              {draft.image_url ? (
                <div className="dropzone__preview">
                  <img src={draft.image_url} alt="" />
                  <div>
                    <div className="dropzone__title">Arte enviada</div>
                    <div className="dropzone__hint">Clique ou arraste para substituir</div>
                  </div>
                </div>
              ) : (
                <>
                  <span className="dropzone__icon" aria-hidden="true">
                    ✦
                  </span>
                  <span className="dropzone__title">
                    {uploading ? 'Enviando...' : 'Arraste a imagem aqui'}
                  </span>
                  <span className="dropzone__hint">PNG, JPEG ou WebP · até 6 MB · recorte automático</span>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void handleFile(event.target.files?.[0])}
                aria-label="Enviar arte"
              />
            </div>

            {draft.image_url && (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                style={{ marginTop: 10 }}
                onClick={() => update({ image_url: '', image_path: '' })}
              >
                Remover arte
              </button>
            )}

            <div style={{ marginTop: 16 }}>
              <Toggle
                checked={draft.holo}
                title="Acabamento holográfico"
                description="Brilho metálico que reage ao mouse e sai no PNG"
                onChange={(checked) => update({ holo: checked })}
              />
            </div>
          </Section>

          <Section step={isMonster ? '05' : '04'} title="Texto e publicação">
            <Field
              label="Descrição / efeito"
              counter={
                <span className={`counter${draft.description.length > MAX_DESCRIPTION ? ' counter--warn' : ''}`}>
                  {draft.description.length}/{MAX_DESCRIPTION}
                </span>
              }
            >
              <textarea
                className="textarea"
                value={draft.description}
                maxLength={MAX_DESCRIPTION}
                placeholder="Escreva o efeito, a lore ou a piada interna que vai virar carta."
                onChange={(event) => update({ description: event.target.value })}
              />
            </Field>

            <Toggle
              checked={draft.is_public}
              title="Publicar na galeria"
              description="Cartas públicas aparecem na home e podem ser vistas por qualquer pessoa"
              onChange={(checked) => update({ is_public: checked })}
            />
          </Section>
        </div>

        <aside className="preview">
          <div className="preview__stage">
            {loading ? (
              <div className="skeleton" style={{ width: '100%', height: 612 }} />
            ) : (
              <CardScaler maxWidth={420}>
                <YgoCard card={draft} />
              </CardScaler>
            )}
          </div>

          <div className="preview__actions">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => void handleSave()}
              disabled={saving || loading}
            >
              {saving ? 'Salvando...' : saved ? 'Salvar alterações' : 'Salvar carta'}
            </button>
            <button type="button" className="btn" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? 'Gerando...' : 'Baixar PNG'}
            </button>
            <button type="button" className="btn" onClick={() => void handleCopyLink()} disabled={!saved}>
              Copiar link
            </button>
          </div>

          {saved && (
            <div className="share-box">
              <code>{shareUrl(saved.slug)}</code>
              <button type="button" className="btn btn--small" onClick={() => void handleCopyLink()}>
                Copiar
              </button>
            </div>
          )}

          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {saved ? (
              <>
                Carta salva · <Link to="/minhas">ver minhas cartas</Link>
              </>
            ) : (
              'A prévia é atualizada em tempo real. Salve para gerar o link público.'
            )}
          </p>
        </aside>
      </div>

      <div className="export-stage" ref={exportRef} aria-hidden="true">
        <YgoCard card={draft} />
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
